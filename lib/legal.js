// Who runs meets.lv, for the privacy policy and the footer.
// The controller's legal name, registration number and address are added
// later; until then the policy says they will be added. Contact e-mail is fixed.
export const CONTROLLER={
 name:'',
 regNumber:'',
 address:'',
 email:'info@meets.lv'
};
export const PRIVACY_UPDATED='2026-11-08';
export const PRIVACY_PATH='/privatums';
export const controllerPending=()=>!CONTROLLER.name||!CONTROLLER.regNumber||!CONTROLLER.address;
