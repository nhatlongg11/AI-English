import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { Tour } from 'shepherd.js';
import type { Session } from '../../types';

export function usePageGuide(session: Session, path: string, search: string) {
  const storageKey=`tenselab-guide-v1:${session.role}:${session.actorId}:${session.demo ? 'demo' : 'real'}`;
  const [dismissed, setDismissed] = useState(() => {
    try {return localStorage.getItem(storageKey) === 'seen';} catch {return false;}
  });
  const [starting, setStarting] = useState(false);
  const tourRef = useRef<Tour|null>(null);
  const generation = useRef(0);
  const busy = useRef(false);
  function dismissInvitation() {
    setDismissed(true);
    try {localStorage.setItem(storageKey,'seen');} catch { /* Help still works without storage. */ }
  }
  useEffect(() => {
    try {setDismissed(localStorage.getItem(storageKey) === 'seen');} catch {setDismissed(false);}
    setStarting(false);busy.current=false;
    return () => {
      generation.current++;
      if(tourRef.current) {void tourRef.current.cancel();tourRef.current=null;}
    };
  },[storageKey,path,search]);
  async function startGuide() {
    if(busy.current || tourRef.current?.isActive()) return;
    busy.current=true;setStarting(true);
    const request=++generation.current;
    try {
      const {createPageTour}=await import('./tour');
      if(generation.current !== request) return;
      const tour=createPageTour(path,session.role,() => {
        if(generation.current === request) dismissInvitation();
      });
      tourRef.current=tour;
      await tour.start();
    } catch {
      if(generation.current === request) toast.error('Chưa mở được hướng dẫn. Bạn thử lại nhé, hoặc xem mục Trợ giúp.');
      if(tourRef.current) {void tourRef.current.cancel();tourRef.current=null;}
    } finally {
      if(generation.current === request) {busy.current=false;setStarting(false);}
    }
  }
  return {startGuide,starting,dismissInvitation,showInvitation:!dismissed && (path.endsWith('/dashboard') || path === '/teacher/students')};
}
