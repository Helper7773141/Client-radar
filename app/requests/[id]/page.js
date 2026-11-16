import {DEMO_REQUESTS} from "../../../lib/requests";
import RequestDetailClient from "./RequestDetailClient";

export const dynamicParams=true;
export function generateStaticParams(){return DEMO_REQUESTS.map(r=>({id:r.id}));}

export default async function RequestDetail({params}){
 const {id}=await params;
 return <RequestDetailClient id={id}/>;
}
