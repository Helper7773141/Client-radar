// Local-only browser demo. NOT a secure data store and NOT approved for real bank records.
export const LOCAL_REQUESTS_KEY="ma-bridge-browser-requests-v1";
export const LOCAL_FAVORITES_KEY="ma-bridge-browser-favorites-v1";
export function loadLocalRequests(){
  try{
    const data=JSON.parse(window.localStorage.getItem(LOCAL_REQUESTS_KEY)||"[]");
    return Array.isArray(data)?data.filter(x=>x&&x.source==="browser"&&typeof x.id==="string"&&/^MY-[A-Z0-9-]+$/.test(x.id)&&typeof x.title==="string"&&typeof x.direction==="string"&&Array.isArray(x.regions)&&Array.isArray(x.info)&&typeof x.priceMin==="number"&&typeof x.priceMax==="number").slice(-100):[];
  }catch{return [];}
}
export function loadFavoriteIds(){
  try{
    const data=JSON.parse(window.localStorage.getItem(LOCAL_FAVORITES_KEY)||"[]");
    return Array.isArray(data)?data.filter(x=>typeof x==="string").slice(-500):[];
  }catch{return [];}
}
export function saveLocalRequests(rows){
  try{window.localStorage.setItem(LOCAL_REQUESTS_KEY,JSON.stringify(rows));return true;}catch{return false;}
}
export function saveFavoriteIds(ids){
  try{window.localStorage.setItem(LOCAL_FAVORITES_KEY,JSON.stringify(ids));return true;}catch{return false;}
}
