import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { act } from 'react';
import Shepherd from 'shepherd.js';
import { createPageTour } from './features/guidance/tour';
import { AuthProvider } from './features/auth/Auth';
import { Students } from './features/teacher/Students';
import { App } from './App';
import { TooltipProvider } from './components/ui/tooltip';
import { demoSession } from './services/demo';
import { ApiClient } from './services/api';
// The guidance test checks navigation/tour cleanup, independent of cold lazy-module loading.
import './features/student/Dashboard';
import './features/student/Progress';
import type { Role } from './types';

function mount(element: React.ReactNode, role: Role = 'admin', path='/teacher/students') {
  sessionStorage.setItem('tenselab-session-v1',JSON.stringify({session:demoSession(role),token:''}));
  return render(<MemoryRouter initialEntries={[path]}><AuthProvider><TooltipProvider>{element}</TooltipProvider></AuthProvider></MemoryRouter>);
}
function visible(element: HTMLElement) {
  vi.spyOn(element,'getClientRects').mockReturnValue([{width:300,height:100,top:0,left:0,bottom:100,right:300,x:0,y:0,toJSON:()=>({})}] as unknown as DOMRectList);
}
beforeEach(() => { localStorage.clear(); });
afterEach(async () => {
  if(Shepherd.activeTour) await act(async () => {await Shepherd.activeTour!.cancel();});
  document.querySelectorAll('[data-guide-fixture]').forEach(el=>el.remove());
});

describe('plain-language student setup',() => {
  it('explains both paths and preserves the API values with an ordinary-learning default',async () => {
    const provision=vi.spyOn(ApiClient.prototype,'provision').mockResolvedValue({id:'new-student',token:'new-access-code',mode:'adaptive',experimentGroup:'general'});
    mount(<Students />);
    const user=userEvent.setup();
    await user.type(screen.getByLabelText('Họ và tên'),'Nguyễn Văn An');
    await user.type(screen.getByLabelText('Lớp'),'8A1');
    expect(screen.getByRole('radio',{name:/Bài tập theo sức học/})).toBeChecked();
    expect(screen.getByRole('radio',{name:/Bài tập theo thứ tự/})).not.toBeChecked();
    expect(screen.queryByText(/Adaptive|Baseline|Chế độ học tập/)).not.toBeInTheDocument();
    expect(screen.getByText('Tùy chọn cho đợt đánh giá').closest('details')).not.toHaveAttribute('open');
    await user.click(screen.getByRole('button',{name:'Tạo mã cho học sinh'}));
    expect(provision).toHaveBeenCalledWith('adaptive','general',undefined,'Nguyễn Văn An','8A1');
    expect(await screen.findByText('new-access-code')).toBeInTheDocument();
    expect(screen.getByText('Mã đã sẵn sàng — sao chép trước khi rời trang')).toBeInTheDocument();
  });
  it('lets an administrator choose a fixed path and optional evaluation label',async () => {
    const provision=vi.spyOn(ApiClient.prototype,'provision').mockResolvedValue({id:'new-student',token:'another-access-code',mode:'baseline',experimentGroup:'NHOM_B'});
    mount(<Students />);
    const user=userEvent.setup();
    await user.type(screen.getByLabelText('Họ và tên'),'Nguyễn Văn An');
    await user.type(screen.getByLabelText('Lớp'),'8A1');
    await user.click(screen.getByRole('radio',{name:/Bài tập theo thứ tự/}));
    await user.click(screen.getByText('Tùy chọn cho đợt đánh giá'));
    const label=screen.getByLabelText('Nhãn nhóm để xem báo cáo');
    await user.clear(label);await user.type(label,'NHOM_B');
    await user.click(screen.getByRole('button',{name:'Tạo mã cho học sinh'}));
    await waitFor(()=>expect(provision).toHaveBeenCalledWith('baseline','NHOM_B',undefined,'Nguyễn Văn An','8A1'));
  });
  it('lets teachers create codes without exposing administrator assignment controls',() => {
    mount(<Students />,'teacher');
    expect(screen.queryByLabelText('Giáo viên phụ trách')).not.toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Tạo mã cho học sinh'})).toBeDisabled();
    expect(screen.getByLabelText('Họ và tên')).toBeRequired();
    expect(screen.getByLabelText('Lớp')).toBeRequired();
    expect(screen.queryByText(/API|backend|roster/)).not.toBeInTheDocument();
  });
});

describe('actual Shepherd tour',() => {
  it('uses the TenseLab theme, supports back/next, skips absent targets and closes with Escape',async () => {
    const fixture=document.createElement('section');fixture.dataset.guideFixture='true';
    fixture.innerHTML='<div data-guide="learning-path">Learning choices</div>';
    document.body.append(fixture);visible(fixture.firstElementChild as HTMLElement);
    const finished=vi.fn();const tour=createPageTour('/teacher/students','admin',finished);
    await act(async()=>{await tour.start();});
    let dialog=screen.getByRole('dialog');
    expect(dialog).toHaveClass('tenselab-tour');
    expect(within(dialog).getByText('Bước 1 / 2')).toBeInTheDocument();
    const user=userEvent.setup();
    await user.click(within(dialog).getByRole('button',{name:'Xem hướng dẫn'}));
    dialog=await screen.findByRole('dialog');
    expect(within(dialog).getByText('Chọn cách giao bài')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button',{name:'Quay lại'}));
    expect(screen.getByText('Một vòng làm quen, thật nhẹ nhàng')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('dialog'),{key:'Escape',keyCode:27});
    await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(finished).toHaveBeenCalledTimes(1);
  });
  it('starts only on request, remembers dismissal and removes the tour on navigation',async () => {
    const view=mount(<App />,'student','/student/dashboard');
    await screen.findByRole('heading',{name:/Chào Minh Anh/});
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const user=userEvent.setup();
    await user.click(screen.getByRole('button',{name:'Để lúc khác'}));
    expect(screen.queryByRole('region',{name:'Làm quen với TenseLab'})).not.toBeInTheDocument();
    await user.click(screen.getByRole('button',{name:'Hướng dẫn'}));
    await screen.findByRole('dialog');
    // Router navigation can also happen through browser history while a tour is open.
    fireEvent.click(screen.getByRole('link',{name:'Tiến bộ của bạn'}));
    await screen.findByRole('heading',{name:'Nhìn lại những bước tiến'});
    await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    view.unmount();
    mount(<App />,'student','/student/dashboard');
    await screen.findByRole('heading',{name:/Chào Minh Anh/});
    expect(screen.queryByRole('region',{name:'Làm quen với TenseLab'})).not.toBeInTheDocument();
  });
});
