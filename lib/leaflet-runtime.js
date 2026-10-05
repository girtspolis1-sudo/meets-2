const RASTER_URL='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const RASTER_ATTRIBUTION='© OpenStreetMap contributors';

export function hasWebGL(doc=typeof document!=='undefined'?document:null){
 if(!doc?.createElement)return false;
 try{
  const canvas=doc.createElement('canvas');
  return Boolean(
   canvas.getContext('webgl2',{failIfMajorPerformanceCaveat:true})||
   canvas.getContext('webgl',{failIfMajorPerformanceCaveat:true})||
   canvas.getContext('experimental-webgl',{failIfMajorPerformanceCaveat:true})
  );
 }catch{
  return false;
 }
}

export function requestedMapMode(search=typeof window!=='undefined'?window.location.search:''){
 try{
  const value=new URLSearchParams(search||'').get('map');
  if(value==='raster')return 'raster';
  if(value==='fail')return 'fail';
 }catch{}
 return 'auto';
}

export async function loadLeaflet(){
 const leafletModule=await import('leaflet');
 return leafletModule.default||leafletModule;
}

export async function enableMapLibre(L){
 await import('@maplibre/maplibre-gl-leaflet');
 if(!L?.maplibreGL)throw new Error('MapLibre Leaflet adapter failed to load');
 return L.maplibreGL;
}

export function addRasterLayer(L,map,{onReady,onFailure,timeoutMs=12000}={}){
 if(!L?.tileLayer)throw new Error('Leaflet raster layer is unavailable');
 const layer=L.tileLayer(RASTER_URL,{
  attribution:RASTER_ATTRIBUTION,
  maxZoom:19,
  crossOrigin:true,
  updateWhenIdle:true
 });
 let ready=false;
 let errors=0;
 let timer=null;
 const cleanup=()=>{if(timer)clearTimeout(timer);};
 const markReady=()=>{
  if(ready)return;
  ready=true;
  cleanup();
  onReady?.();
 };
 layer.on('load',markReady);
 layer.on('tileload',markReady);
 layer.on('tileerror',()=>{
  errors++;
  if(!ready&&errors>=4){
   cleanup();
   onFailure?.(new Error('Raster map tiles failed to load'));
  }
 });
 timer=setTimeout(()=>{
  if(!ready)onFailure?.(new Error('Raster map tiles timed out'));
 },timeoutMs);
 layer.addTo(map);
 return {layer,cleanup};
}

export function removeLayerSafe(layer){
 try{layer?.remove?.();}catch{}
}
