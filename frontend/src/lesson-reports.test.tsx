import {describe,it,expect,vi} from 'vitest';
import {render,screen,waitFor,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {AuthContext} from './features/auth/context';
import {LessonReports,reportStatistics} from './features/teacher/LessonReports';
import {ApiClient} from './services/api';
import type {LessonDetail} from './types';

function fixture():LessonDetail{
  return {id:'lesson-1',title:'Buổi 7',heldOn:'2026-11-03',createdBy:'teacher-test',createdAt:'2026-11-03',total:4,marked:3,reportClassName:'Lớp 7A',vocabularyTotal:15,records:[
    {studentId:'student-a',status:'present',homeworkStatus:'complete',vocabularyKnown:14,miniTestScore:9},
    {studentId:'student-b',status:'late',homeworkStatus:'partial',vocabularyKnown:15,miniTestScore:0},
    {studentId:'student-c',status:'excused',homeworkStatus:'missing',vocabularyKnown:0,miniTestScore:null},
    {studentId:'student-d',status:'unmarked',homeworkStatus:'unmarked',vocabularyKnown:null,miniTestScore:null},
  ].map((row,i)=>({...row,status:row.status as LessonDetail['records'][number]['status'],homeworkStatus:row.homeworkStatus as LessonDetail['records'][number]['homeworkStatus'],markedAt:null,markedBy:null,reportedAt:null,reportedBy:null,student:{id:row.studentId,displayName:['Bảo An','Khánh Linh','Tường Vy','Quỳnh Anh'][i],className:'7A',teacherId:'teacher-test'}}))};
}
function mount(){const api=new ApiClient('real-account-test');return render(<MemoryRouter><AuthContext.Provider value={{api,session:{role:'teacher',actorId:'teacher-test'},token:'real-account-test',login:vi.fn(),demo:vi.fn(),logout:vi.fn()}}><LessonReports/></AuthContext.Provider></MemoryRouter>);}
function mockReport(lesson:LessonDetail){vi.spyOn(ApiClient.prototype,'lessons').mockResolvedValue({lessons:[lesson],nextOffset:null});return vi.spyOn(ApiClient.prototype,'lesson').mockResolvedValue({lesson});}

describe('lesson learning reports',()=>{
  it('counts late arrivals as present, includes real zero scores and excludes missing scores from averages',()=>{
    const stats=reportStatistics(fixture());
    expect(stats).toMatchObject({total:4,present:2,late:1,excused:1,unmarked:1,complete:1,partial:1,missing:1,unchecked:1,vocabulary:{count:3,best:10,leaders:['Khánh Linh']},miniTest:{count:2,average:4.5,best:9,leaders:['Bảo An']}});
    expect(stats.vocabulary.average).toBeCloseTo((14/15*10+10)/3);
    const empty=fixture();empty.records=empty.records.map(r=>({...r,vocabularyKnown:null,miniTestScore:null}));
    expect(reportStatistics(empty).vocabulary).toEqual({count:0,average:null,best:null,leaders:[]});
  });
  it('shows saved results with readable names and only prints after selecting a lesson',async()=>{
    mockReport(fixture());const print=vi.spyOn(window,'print').mockImplementation(()=>{});mount();const user=userEvent.setup();
    expect(screen.getByRole('button',{name:'In / Lưu PDF'})).toBeDisabled();
    await user.click(await screen.findByRole('checkbox',{name:/Buổi 7/}));
    const report=await screen.findByRole('region',{name:'Báo cáo Buổi 7'});
    const row=within(report).getByRole('row',{name:/Bảo An/});
    expect(within(row).getByText('14/15')).toBeInTheDocument();expect(within(row).getByText('9,3')).toBeInTheDocument();
    expect(within(report).getByText('6,4')).toBeInTheDocument();expect(within(report).getByText('4,5')).toBeInTheDocument();
    expect(within(report).getByText('Vắng có phép')).toBeInTheDocument();expect(within(report).queryByText(/student_Bảo/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button',{name:'In / Lưu PDF'}));expect(print).toHaveBeenCalledTimes(1);
  });
  it('keeps unsaved input on server errors, blocks printing while editing and reloads persisted results',async()=>{
    const saved=fixture();const read=mockReport(saved);const save=vi.spyOn(ApiClient.prototype,'saveLessonReport').mockRejectedValueOnce(new Error('Không kết nối được.')).mockImplementation(async(_id,body)=>{
      const lesson={...saved,reportClassName:body.reportClassName,vocabularyTotal:body.vocabularyTotal,records:saved.records.map(r=>({...r,...body.records.find(v=>v.studentId===r.studentId)}))};read.mockResolvedValue({lesson});return {lesson};
    });
    mount();const user=userEvent.setup();await user.click(await screen.findByRole('checkbox',{name:/Buổi 7/}));
    await user.click(await screen.findByRole('button',{name:'Nhập / sửa kết quả'}));
    expect(screen.getByRole('button',{name:'In / Lưu PDF'})).toBeDisabled();expect(screen.getByRole('checkbox',{name:/Buổi 7/})).toBeDisabled();
    const words=screen.getByRole('spinbutton',{name:'Số từ thuộc Bảo An'});await user.clear(words);await user.type(words,'12');
    await user.selectOptions(screen.getByRole('combobox',{name:'Bài tập về nhà Bảo An'}),'partial');
    await user.click(screen.getByRole('button',{name:'Lưu kết quả'}));expect(await screen.findByText('Không kết nối được.')).toBeInTheDocument();expect(words).toHaveValue(12);
    await user.click(screen.getByRole('button',{name:'Lưu kết quả'}));
    await waitFor(()=>expect(save).toHaveBeenCalledTimes(2));
    expect(save).toHaveBeenLastCalledWith('lesson-1',expect.objectContaining({vocabularyTotal:15,records:expect.arrayContaining([{studentId:'student-a',homeworkStatus:'partial',vocabularyKnown:12,miniTestScore:9}])}));
    expect(await screen.findByText('12/15')).toBeInTheDocument();expect(screen.queryByRole('spinbutton',{name:'Số từ thuộc Bảo An'})).not.toBeInTheDocument();
    expect(screen.getByRole('button',{name:'In / Lưu PDF'})).toBeEnabled();
  });
  it('combines selected lessons in date order and omits the mini-test column when no scores exist',async()=>{
    const first=fixture();first.title='Buổi 5';first.heldOn='2026-10-28';first.records=first.records.map(r=>({...r,miniTestScore:null}));
    const second={...fixture(),id:'lesson-2',title:'Buổi 6',heldOn:'2026-10-29'};
    vi.spyOn(ApiClient.prototype,'lessons').mockResolvedValue({lessons:[second,first],nextOffset:null});
    vi.spyOn(ApiClient.prototype,'lesson').mockImplementation(async id=>({lesson:id===first.id?first:second}));
    mount();const user=userEvent.setup();await user.click(await screen.findByRole('checkbox',{name:/Buổi 6/}));await user.click(screen.getByRole('checkbox',{name:/Buổi 5/}));
    await waitFor(()=>expect(screen.getAllByRole('region',{name:/Báo cáo Buổi/})).toHaveLength(2));
    expect(screen.getAllByRole('region',{name:/Báo cáo Buổi/})[0]).toHaveAccessibleName('Báo cáo Buổi 5');
    expect(within(screen.getByRole('region',{name:'Báo cáo Buổi 5'})).queryByRole('columnheader',{name:/Mini test/})).not.toBeInTheDocument();
    expect(await screen.findByRole('heading',{name:'Báo cáo học tập hằng tuần'})).toBeInTheDocument();
  });
});
