import type { GenerateRequest, QuestionInput } from './domain.js';
import { AppError } from './config.js';

// Author-written representative examples, NOT a validated educational research dataset.
// Each row: tense, question, answer, distractors, skill/error, Vietnamese explanation.
const rows: [QuestionInput['tense'], string, string, string[], QuestionInput['errorCode'], string][] = [
  ['present_simple','Every morning, Lan ____ to school.','walks',['walk','walking'],'E01','Lan là chủ ngữ số ít ngôi thứ ba nên động từ walk thêm s.'],
  ['present_simple','My brother ____ football every Sunday.','plays',['play','playing'],'E01','My brother là ngôi thứ ba số ít, vì vậy dùng plays.'],
  ['present_simple','The sun ____ in the east every day.','rises',['rise','rising'],'E01','The sun là chủ ngữ số ít, dùng rises để nói sự thật hiển nhiên.'],
  ['present_simple','We ____ English every Monday.','study',['studies','studying'],'E01','We dùng động từ nguyên mẫu study trong thì hiện tại đơn.'],
  ['present_simple','____ Mai like milk?','Does',['Do','Is'],'E08','Câu hỏi hiện tại đơn với Mai dùng trợ động từ Does.'],
  ['present_simple','They ____ not eat meat.','do',['does','are'],'E06','Câu phủ định hiện tại đơn với they dùng do not.'],
  ['present_simple','Where ____ your father work every day?','does',['do','is'],'E05','Câu hỏi với từ để hỏi dùng Where + does + chủ ngữ + động từ nguyên mẫu.'],
  ['present_simple','Nam does not ____ coffee.','drink',['drinks','drinking'],'E08','Sau does not, động từ chính ở dạng nguyên mẫu drink.'],
  ['present_simple','____ you usually get up at six?','Do',['Does','Are'],'E03','Cần trợ động từ Do trước you để tạo câu hỏi hiện tại đơn.'],
  ['present_simple','My mother ____ dinner every evening.','cooks',['cook','cooking'],'E01','My mother là chủ ngữ số ít nên động từ cook thêm s.'],
  ['past_simple','Yesterday, Lan ____ to school.','walked',['walks','walking'],'E02','Yesterday chỉ thời gian đã qua, cần dùng quá khứ đơn walked.'],
  ['past_simple','Last night, we ____ a film.','watched',['watch','watching'],'E04','Động từ watch có quy tắc, thêm ed thành watched trong quá khứ đơn.'],
  ['past_simple','Yesterday, Nam ____ a new book.','bought',['buyed','buys'],'E04','Buy là động từ bất quy tắc, dạng quá khứ là bought.'],
  ['past_simple','Last Sunday, they ____ to the zoo.','went',['goed','goes'],'E04','Go có dạng quá khứ bất quy tắc là went.'],
  ['past_simple','____ you visit Hue last year?','Did',['Do','Does'],'E05','Câu hỏi quá khứ đơn dùng Did + chủ ngữ + động từ nguyên mẫu.'],
  ['past_simple','She did not ____ to class yesterday.','go',['went','goes'],'E06','Sau did not dùng động từ nguyên mẫu go, không dùng went.'],
  ['past_simple','Where ____ he live in 2020?','did',['does','is'],'E08','Năm 2020 đã qua nên câu hỏi dùng trợ động từ did.'],
  ['past_simple','I ____ my homework last night.','did',['doed','does'],'E04','Do là động từ bất quy tắc, quá khứ đơn dùng did.'],
  ['past_simple','We ____ happy at the party yesterday.','were',['was','are'],'E01','We đi với were ở quá khứ đơn của động từ be.'],
  ['past_simple','Mai ____ not at home yesterday.','was',['were','is'],'E01','Mai là ngôi thứ ba số ít, quá khứ của be dùng was.'],
  ['present_continuous','Look! Lan ____ a book now.','is reading',['reading','are reading'],'E03','Hiện tại tiếp diễn cần be + V-ing, với Lan dùng is reading.'],
  ['present_continuous','Listen! The children ____ now.','are singing',['is singing','singing'],'E01','The children là số nhiều, cần are + singing.'],
  ['present_continuous','I ____ my homework right now.','am doing',['is doing','doing'],'E08','Chủ ngữ I đi với am trong cấu trúc am + V-ing.'],
  ['present_continuous','Look! The dog is ____ in the garden.','running',['runing','run'],'E07','Run có một nguyên âm trước phụ âm cuối, gấp đôi n rồi thêm ing: running.'],
  ['present_continuous','Be quiet! The baby is ____ now.','sleeping',['sleep','sleeps'],'E07','Sau is dùng dạng V-ing: sleeping.'],
  ['present_continuous','____ they playing chess right now?','Are',['Is','Do'],'E05','Câu hỏi hiện tại tiếp diễn đảo Are lên trước chủ ngữ they.'],
  ['present_continuous','She ____ not watching TV at the moment.','is',['are','does'],'E06','Phủ định hiện tại tiếp diễn với she dùng is not + V-ing.'],
  ['present_continuous','Look! He is ____ a bike.','riding',['rideing','rides'],'E07','Ride bỏ e cuối rồi thêm ing thành riding.'],
  ['present_continuous','At this moment, we ____ for the bus.','are waiting',['wait','waited'],'E02','At this moment cho biết hành động đang diễn ra, dùng are waiting.'],
  ['present_continuous','Look! Hoa ____ a letter now.','is writing',['writing','are writing'],'E03','Hoa là số ít, cấu trúc hiện tại tiếp diễn cần is + writing.'],
];

export const grammarExamples: QuestionInput[] = rows.map(([tense, content, correctAnswer, wrong, errorCode, explanationVi]) => ({
  tense, content, correctAnswer, errorCode, explanationVi, questionType:'multiple_choice', difficulty:1,
  grammarRule: `${tense}: ${explanationVi}`,
  options: [{text:correctAnswer,errorCode:null}, ...wrong.map(text => ({text,errorCode}))],
}));

const verbCues: Record<string,string> = {
  walks:'walk',plays:'play',rises:'rise',study:'study',does:'do',do:'do',drink:'drink',cooks:'cook',
  walked:'walk',watched:'watch',bought:'buy',went:'go',did:'do',go:'go',were:'be',was:'be',
  'is reading':'read','are singing':'sing','am doing':'do',running:'run',sleeping:'sleep',are:'be',
  is:'be',riding:'ride','are waiting':'wait','is writing':'write',
};

export function mockQuestions(request: GenerateRequest) {
  const pool = grammarExamples.filter(q => q.tense === request.tense && (!request.targetErrorCode || q.errorCode === request.targetErrorCode));
  if (pool.length < request.count) throw new AppError(422,'MOCK_CONTENT_INSUFFICIENT','Not enough explicit mock examples for this scope; reduce count or remove targetErrorCode');
  return {questions: pool.slice(0, request.count).map(q => {
    const base = {...q, difficulty:request.difficulty, questionType:request.questionType};
    if (request.questionType === 'fill_in_blank') {
      const cue=verbCues[q.correctAnswer.toLowerCase()];
      if (!cue) throw new Error('Authored fixture is missing its verb cue');
      return {...base, content:base.content.replace('____',`____ (${cue})`), options:[]};
    }
    if (request.questionType === 'error_correction') {
      return {...base, options:[], content:`Correct this sentence: ${q.content.replace('____', q.options[1]!.text)}`,
        correctAnswer:q.content.replace('____',q.correctAnswer)};
    }
    // Rotate answer position so mock submissions do not always choose the first option.
    const offset = grammarExamples.indexOf(q) % q.options.length;
    return {...base, options:[...q.options.slice(offset),...q.options.slice(0,offset)]};
  })};
}
