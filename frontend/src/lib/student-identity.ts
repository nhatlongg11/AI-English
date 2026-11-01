export interface StudentIdentity {id:string;displayName?:string|null;className?:string|null}
const part=(value:string|null|undefined,fallback:string)=>(value?.normalize('NFC').trim()||fallback).replace(/[\s_]+/gu,'_');
// A readable label only; UUIDs, relations and access credentials stay unchanged.
export function studentLabel(student:StudentIdentity){
  return `student_${part(student.displayName,'chưa nhập tên')}_${part(student.className,'chưa nhập lớp')}_${student.id.slice(0,8)}`;
}
