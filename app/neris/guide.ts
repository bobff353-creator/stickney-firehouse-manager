// Page references verified against the supplied June 21, 2026 NERIS guide.
export const guidePages:Record<string,number>={core:53,location:55,dispatch:54,units:54,actions:60,details:67,emerging:68,exposures:70,risk:65,rescues:64,narrative:70,review:48};
export const incidentCategories:Record<string,string>={FIRE:'Fire',MEDICAL:'Medical',HAZSIT:'Hazardous situation',RESCUE:'Rescue',PUBSERV:'Public service',NOEMERG:'No emergency',LAWENFORCE:'Law enforcement'};
export const incidentTypeGuides:Record<string,string>={FIRE:'https://neris-prod-public.s3.us-east-2.amazonaws.com/docs/fire_types.neris.pdf',MEDICAL:'https://neris-prod-public.s3.us-east-2.amazonaws.com/docs/medical_types.neris.pdf',HAZSIT:'https://neris-prod-public.s3.us-east-2.amazonaws.com/docs/hazsit_types.neris.pdf',RESCUE:'https://neris-prod-public.s3.us-east-2.amazonaws.com/docs/rescue_types.neris.pdf',PUBSERV:'https://neris-prod-public.s3.us-east-2.amazonaws.com/docs/pubserv_types.neris.pdf',NOEMERG:'https://neris-prod-public.s3.us-east-2.amazonaws.com/docs/noemerg_types.neris.pdf'};
export const sectionHelp:Record<string,string>={
 core:'Choose up to three final incident types based on what responders found. At most one can be primary; the dispatch label may be different.',
 location:'Record the main incident location here. Main-incident displacements belong here; displacement caused by a separate exposure belongs with that exposure.',
 actions:'Record each assisting department and the direction and nature of aid. Non-fire agencies have a separate selection.',
 details:'Fire, medical, and hazardous-situation details follow the final incident types selected in Incident. Record a separate medical entry for each patient without adding patient names.',
 emerging:'Use this section for the listed emerging technologies and hazards. Ordinary electrical failures are not automatically emerging hazards.',
 risk:'Structure fires require alarm and suppression details, subject to the official aid exception. Other incident types can include this information when known.',
 narrative:'Explain the outcome and obstacles. Add useful context without repeating every field or inventing missing details.',
};
