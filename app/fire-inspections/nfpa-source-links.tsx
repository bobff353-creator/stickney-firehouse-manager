export default function NfpaSourceLinks({source}:{source:string}){
 const links=[...new Set(source.match(/https:\/\/(?:www|link)\.nfpa\.org\/[^\s]+/g)||[])];
 if(!links.length)return null;
 return <div className="fi-actions">{links.map(url=><a key={url} href={url} target="_blank" rel="noreferrer">{url.startsWith('https://link.nfpa.org/')?'Open saved research edition in NFPA free view ↗':'Official NFPA page & other editions ↗'}</a>)}</div>;
}
