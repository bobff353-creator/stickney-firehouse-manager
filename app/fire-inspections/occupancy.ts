import {OCCUPANCY_GROUPS,normalizeGroupCodes,getOccupancyGroup,buildGroupChecklist} from './reference-library/occupancy-groups';
import {freshCheck,type InspectionCheck} from './model';
export {OCCUPANCY_GROUP_NOTE} from './reference-library/occupancy-groups';
export const groupChoices=OCCUPANCY_GROUPS;
export const groupLabel=(code:string)=>getOccupancyGroup(code)?.label??code;
export const groupsFor=(data:{occupancyGroup?:string;additionalOccupancyGroups?:string[]})=>normalizeGroupCodes([data.occupancyGroup??'',...(data.additionalOccupancyGroups??[])]);
export function nativeGroupChecks(groups:string[],systems:string[]=[]):InspectionCheck[]{return buildGroupChecklist(normalizeGroupCodes(groups),systems).slice(0,200).map(item=>freshCheck({id:item.id,section:item.category,label:item.title,source:[item.guidance,item.condition,...(item.researchSources??[]).map(source=>source.title+' — '+source.url)].filter(Boolean).join('\n')}));}
