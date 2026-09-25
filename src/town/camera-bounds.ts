// The mountain mesh begins at radius 150. Keep the camera on the valley side
// of its foothills, including when the orbit target is away from town center.
export const CAMERA_VALLEY_RADIUS = 138;
export const CAMERA_BASE_FOV = 43;

export function boundedOrbitDistance(targetX:number,targetZ:number,azimuth:number,elevation:number,requestedDistance:number):number{
  const horizontal=Math.sin(elevation);
  const dx=Math.cos(azimuth)*horizontal,dz=Math.sin(azimuth)*horizontal;
  const a=dx*dx+dz*dz,b=2*(targetX*dx+targetZ*dz);
  const c=targetX*targetX+targetZ*targetZ-CAMERA_VALLEY_RADIUS*CAMERA_VALLEY_RADIUS;
  if(a<1e-8||c>=0)return requestedDistance;
  const boundary=(-b+Math.sqrt(b*b-4*a*c))/(2*a);
  return Math.min(requestedDistance,Math.max(0,boundary));
}

export function orbitFieldOfView(requestedDistance:number,cameraDistance:number):number{
  return Math.min(75,2*Math.atan(Math.tan(CAMERA_BASE_FOV*Math.PI/360)*requestedDistance/cameraDistance)*180/Math.PI);
}
