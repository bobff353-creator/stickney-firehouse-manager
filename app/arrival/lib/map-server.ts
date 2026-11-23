import {HttpError} from './server';
import {inCookCounty} from './footprint';
export function mapRequest(request:Request){const q=new URL(request.url).searchParams;const lng=Number(q.get('lng')),lat=Number(q.get('lat')),span=Number(q.get('span'));if(!q.has('lng')||!q.has('lat')||!q.has('span')||![lng,lat,span].every(Number.isFinite)||span<40||span>5000||!inCookCounty(lng,lat))throw new HttpError(422,'This pilot provides aerials and footprint lookup in Cook County, Illinois. Enter a location in that coverage area; span must be 40–5,000 map meters.');return {lng,lat,span};}
