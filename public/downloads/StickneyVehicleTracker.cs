// Stickney vehicle-only location companion. No administrator rights, service,
// startup registration, route history, or personal-account credentials required.
// Compile with the adjacent PowerShell launcher. --self-test never acquires GPS.
using System;
using System.Collections.Generic;
using System.Device.Location;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

public sealed class StickneyVehicleTracker : Form {
 readonly TextBox setup=new TextBox { Dock=DockStyle.Top,UseSystemPasswordChar=true };
 readonly Label status=new Label { Dock=DockStyle.Fill,Padding=new Padding(12),Text="Paste the Windows setup created in Respond, then Start sharing.",AutoSize=false };
 readonly Button start=new Button { Text="Start sharing",AutoSize=true };
 readonly Button stop=new Button { Text="Stop sharing",AutoSize=true };
 readonly Button forget=new Button { Text="Forget pairing",AutoSize=true };
 readonly NotifyIcon tray=new NotifyIcon { Icon=SystemIcons.Information,Text="Stickney vehicle tracking",Visible=true };
 readonly System.Windows.Forms.Timer timer=new System.Windows.Forms.Timer { Interval=1000 };
 readonly HttpClient http=new HttpClient(new HttpClientHandler { AllowAutoRedirect=false }) { Timeout=TimeSpan.FromSeconds(10) };
 readonly JavaScriptSerializer json=new JavaScriptSerializer();
 readonly string configPath=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"StickneyVehicleTracker","pairing.bin");
 GeoCoordinateWatcher watcher; GeoPosition<GeoCoordinate> latest; GeoCoordinate last;
 string endpoint,token,unit; bool running,busy,lastMoving; int runId; CancellationTokenSource cancellation;
 DateTime lastSent=DateTime.MinValue,nextAttempt=DateTime.MinValue,lastRestart=DateTime.MinValue;
 public StickneyVehicleTracker(){
  Text="Stickney — Vehicle location";Width=570;Height=340;MinimumSize=new Size(390,300);StartPosition=FormStartPosition.CenterScreen;
  var introduction=new Label { Text="VEHICLE DEVICE ONLY\nKeeps sharing while minimized or other applications are open. Windows must stay awake, online, and allow location. Hardware GPS accuracy must be tested at the station.",Dock=DockStyle.Top,Height=78,Padding=new Padding(10) };
  var actions=new FlowLayoutPanel { Dock=DockStyle.Bottom,Height=52,Padding=new Padding(8) };actions.Controls.AddRange(new Control[]{start,stop,forget});
  Controls.Add(status);Controls.Add(setup);Controls.Add(introduction);Controls.Add(actions);
  start.Click+=delegate { StartSharing(); };stop.Click+=delegate { StopSharing();status.Text="Sharing stopped. Other screens retain the last known position."; };
  forget.Click+=delegate { if(MessageBox.Show("Forget this vehicle pairing on this Windows account? Disable the sender in Respond to revoke it everywhere.","Forget pairing",MessageBoxButtons.YesNo)==DialogResult.Yes){StopSharing();if(File.Exists(configPath))File.Delete(configPath);setup.Text="";token=null;status.Text="Pairing forgotten on this Windows account.";} };
  tray.DoubleClick+=delegate { Show();WindowState=FormWindowState.Normal;Activate(); };
  tray.ContextMenuStrip=new ContextMenuStrip();tray.ContextMenuStrip.Items.Add("Show tracker",null,delegate { Show();WindowState=FormWindowState.Normal;Activate(); });
  tray.ContextMenuStrip.Items.Add("Stop sharing",null,delegate { StopSharing();status.Text="Sharing stopped."; });tray.ContextMenuStrip.Items.Add("Exit",null,delegate { Close(); });
  Resize+=delegate { if(WindowState==FormWindowState.Minimized)Hide(); };
  FormClosing+=delegate { StopSharing();tray.Visible=false;tray.Dispose();http.Dispose(); };
  timer.Tick+=async delegate { await Tick(); };
  Shown+=delegate { try { if(File.Exists(configPath)){setup.Text=Encoding.UTF8.GetString(ProtectedData.Unprotect(File.ReadAllBytes(configPath),null,DataProtectionScope.CurrentUser));status.Text="Saved pairing loaded. Select Start sharing when this device is mounted in its assigned apparatus.";} }catch{status.Text="Saved pairing could not be opened. Create a replacement in Respond.";} };
 }
 static bool ValidSetup(Dictionary<string,object> config){
  object address,secret,label;Uri uri;
  return config.TryGetValue("endpoint",out address)&&Uri.TryCreate(address as string,UriKind.Absolute,out uri)
   &&uri.Scheme=="https"&&uri.Host=="stickney-firehouse-manager.vercel.app"&&uri.Port==443&&uri.UserInfo==""
   &&uri.AbsolutePath=="/api/apparatus-locations/ingest"&&uri.Query==""&&uri.Fragment==""
   &&config.TryGetValue("token",out secret)&&secret is string&&System.Text.RegularExpressions.Regex.IsMatch((string)secret,"^[A-Za-z0-9_-]{43}$")
   &&config.TryGetValue("unit",out label)&&label is string&&((string)label).Length<=20;
 }
 void StartSharing(){
  try{
   var config=json.Deserialize<Dictionary<string,object>>(setup.Text.Trim());if(!ValidSetup(config)){status.Text="Paste a valid Windows pairing from the Stickney Respond page.";return;}
   StopSharing();endpoint=(string)config["endpoint"];token=(string)config["token"];unit=(string)config["unit"];
   Directory.CreateDirectory(Path.GetDirectoryName(configPath));File.WriteAllBytes(configPath,ProtectedData.Protect(Encoding.UTF8.GetBytes(json.Serialize(config)),null,DataProtectionScope.CurrentUser));
   cancellation=new CancellationTokenSource();running=true;runId++;last=null;latest=null;lastSent=DateTime.MinValue;nextAttempt=DateTime.MinValue;
   watcher=new GeoCoordinateWatcher(GeoPositionAccuracy.High);watcher.MovementThreshold=0;
   int watcherRun=runId;
   watcher.PositionChanged+=delegate(object sender,GeoPositionChangedEventArgs<GeoCoordinate> args){if(running&&watcherRun==runId)latest=args.Position;};
   watcher.Start(false);lastRestart=DateTime.UtcNow;timer.Start();status.Text="Unit "+unit+": waiting for an accurate, fresh location. Allow location in Windows privacy settings if prompted.";
  }catch{StopSharing();status.Text="Location could not start. Check Windows location permissions and the pairing setup. No location was assumed.";}
 }
 void StopSharing(){running=false;runId++;timer.Stop();if(cancellation!=null)cancellation.Cancel();if(watcher!=null){watcher.Stop();watcher.Dispose();watcher=null;}latest=null;}
 public static bool ValidFix(GeoCoordinate point,DateTimeOffset measured,DateTime now){return point!=null&&!point.IsUnknown&&!double.IsNaN(point.HorizontalAccuracy)&&point.HorizontalAccuracy>0&&point.HorizontalAccuracy<=75&&measured.UtcDateTime>=now.AddSeconds(-30)&&measured.UtcDateTime<=now.AddSeconds(5);}
 public static bool Due(double elapsed,bool moving,bool previousMoving,bool first){return first||elapsed>=5&&(moving!=previousMoving||elapsed>=(moving?5:120));}
 async Task Tick(){
  if(!running||busy||DateTime.UtcNow<nextAttempt)return;
  var now=DateTime.UtcNow;
  if(watcher.Permission==GeoPositionPermission.Denied){status.Text="Location permission denied. Enable Windows location access. Last known position remains unchanged.";return;}
  if(latest==null||!ValidFix(latest.Location,latest.Timestamp,now)){
   status.Text="Unit "+unit+": waiting for a fresh location accurate to 75 metres or better. No approximate/default position is sent.";
   if(now-lastRestart>TimeSpan.FromSeconds(20)){watcher.Stop();watcher.Start(false);lastRestart=now;}return;
  }
  var point=latest.Location;var measured=latest.Timestamp;
  bool moving=(!double.IsNaN(point.Speed)&&point.Speed>=1.5)||(last!=null&&point.GetDistanceTo(last)>Math.Max(20,Math.Min(point.HorizontalAccuracy,last.HorizontalAccuracy)));
  if(!Due((now-lastSent).TotalSeconds,moving,lastMoving,last==null))return;
  busy=true;int own=runId;
  try{
   var payload=new Dictionary<string,object>{{"latitude",point.Latitude},{"longitude",point.Longitude},{"accuracy",point.HorizontalAccuracy},{"measuredAt",measured.ToUniversalTime().ToString("o",CultureInfo.InvariantCulture)},{"moving",moving}};
   using(var request=new HttpRequestMessage(HttpMethod.Post,endpoint)){
    request.Headers.Authorization=new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer",token);
    request.Content=new StringContent(json.Serialize(payload),Encoding.UTF8,"application/json");
    using(var response=await http.SendAsync(request,cancellation.Token)){
     if(!running||own!=runId)return;
     if(response.StatusCode==HttpStatusCode.Unauthorized){StopSharing();status.Text="This vehicle pairing expired or was disabled. Create a replacement in Respond.";return;}
     var result=json.Deserialize<Dictionary<string,object>>(await response.Content.ReadAsStringAsync());object accepted;
     if(response.IsSuccessStatusCode&&result.TryGetValue("accepted",out accepted)&&accepted is bool&&(bool)accepted){last=point;lastSent=DateTime.UtcNow;lastMoving=moving;nextAttempt=DateTime.MinValue;status.Text="Unit "+unit+": sharing location, accuracy ±"+Math.Round(point.HorizontalAccuracy)+" m. Last saved "+lastSent.ToLocalTime().ToString("T")+".\n"+(moving?"Moving: at most one update every 5 seconds.":"Stationary: one update every 2 minutes.")+"\nMinimize this window to keep sharing while using other applications.";}
     else{nextAttempt=DateTime.UtcNow.AddSeconds(15);status.Text="Location not accepted. Check GPS accuracy and Windows time. Last confirmed position is retained.";}
    }
   }
  }catch{if(running&&own==runId){nextAttempt=DateTime.UtcNow.AddSeconds(15);status.Text="Connection interrupted. Will retry with a fresh fix; old positions are not replayed.";}}
  finally{busy=false;}
 }
 static int SelfTest(){
  var now=DateTime.UtcNow;
  if(!ValidFix(new GeoCoordinate(41.8,-87.7,0,10,0,0,0),new DateTimeOffset(now),now))return 1;
  if(ValidFix(new GeoCoordinate(41.8,-87.7,0,500,0,0,0),new DateTimeOffset(now),now))return 2;
  if(ValidFix(new GeoCoordinate(41.8,-87.7,0,10,0,0,0),new DateTimeOffset(now.AddMinutes(-2)),now))return 3;
  if(Due(4,true,true,false)||!Due(5,true,true,false)||Due(119,false,false,false)||!Due(120,false,false,false))return 4;
  if(ValidSetup(new Dictionary<string,object>{{"endpoint","https://example.invalid/api/apparatus-locations/ingest"},{"token",new string('x',43)},{"unit","TEST"}}))return 5;
  Console.WriteLine("PASS: Windows sender accuracy, freshness, cadence and destination checks. No GPS or network accessed.");return 0;
 }
 [STAThread] public static int Main(string[] args){
  if(args.Length==1&&args[0]=="--self-test")return SelfTest();
  bool created;using(var mutex=new Mutex(true,"Local\\StickneyVehicleTracker",out created)){
   if(!created){MessageBox.Show("The vehicle tracker is already running. Open it from the notification area.");return 0;}
   ServicePointManager.SecurityProtocol=SecurityProtocolType.Tls12;Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);Application.Run(new StickneyVehicleTracker());return 0;
  }
 }
}
