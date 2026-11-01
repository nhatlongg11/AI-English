// Original AI-assisted exercises, not mock fixtures or a validated research dataset.
// Run from the repository root, or stream into the existing /app Docker runtime:
// docker compose exec -T api node --input-type=module < scripts/seed-curriculum.mjs
import process from 'node:process';
import console from 'node:console';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';

export const curriculumVersion = 'tenselab-starter-v1';
export const curriculumAuthor = 'system:tenselab-starter-v1';

// Each independent context produces one multiple-choice, one constrained fill-in,
// and one correction/sentence-building exercise. Difficulty is an editorial estimate.
// Fields: difficulty, target skill, sentence with verb cue, answer, distractors,
// Vietnamese explanation, grammar rule. Distractors have no inferred diagnosis.
export const lessons = {
  present_simple: [
    [1, 'E01', 'Our class ____ (start) at seven every morning.', 'starts', ['start', 'starting', 'is start'],
      'Our class là một tập thể được xem là số ít. Khi nói về lịch học thường lệ, start thêm -s thành starts.',
      'Chủ ngữ ngôi thứ ba số ít + V-s/es trong câu khẳng định hiện tại đơn.'],
    [1, 'E01', 'My cousins ____ (live) near the river.', 'live', ['lives', 'living', 'is live'],
      'My cousins là chủ ngữ số nhiều. Ở hiện tại đơn, ta dùng động từ nguyên mẫu live, không thêm -s.',
      'I/you/we/they và chủ ngữ số nhiều + động từ nguyên mẫu.'],
    [1, 'E01', 'The school library ____ (be) quiet every morning.', 'is', ['are', 'am', 'be'],
      'The school library là một danh từ số ít nên đi với is. Câu mô tả đặc điểm thường thấy của thư viện.',
      'Hiện tại đơn của be: I am; he/she/it is; you/we/they are.'],
    [2, 'E01', 'My aunt ____ (teach) science on Tuesdays.', 'teaches', ['teachs', 'teach', 'teaching'],
      'My aunt là ngôi thứ ba số ít. Teach kết thúc bằng -ch nên thêm -es để tạo teaches.',
      'Động từ kết thúc bằng -ch/-sh/-s/-x thường thêm -es với ngôi thứ ba số ít.'],
    [2, 'E01', 'Linh ____ (study) English after dinner every day.', 'studies', ['studys', 'study', 'studying'],
      'Linh là chủ ngữ số ít. Study có phụ âm đứng trước y nên đổi y thành i rồi thêm -es: studies.',
      'Phụ âm + y: đổi y thành -ies khi chia ngôi thứ ba số ít.'],
    [2, 'E01', 'Our neighbour ____ (have) two friendly dogs.', 'has', ['haves', 'have', 'having'],
      'Our neighbour là chủ ngữ số ít. Have có dạng ngôi thứ ba số ít bất quy tắc là has.',
      'Have đổi thành has với he/she/it hoặc chủ ngữ số ít.'],
    [3, 'E06', 'We ____ (not watch) television on school nights.', 'do not watch', ['does not watch', 'do not watches', 'not watch'],
      'Với we, câu phủ định dùng do not rồi đến động từ nguyên mẫu watch. Bài này yêu cầu viết dạng đầy đủ.',
      'I/you/we/they + do not + động từ nguyên mẫu.'],
    [3, 'E06', 'Minh ____ (not like) spicy food.', 'does not like', ['do not like', 'does not likes', 'not likes'],
      'Minh là chủ ngữ ngôi thứ ba số ít nên dùng does not. Sau does not, like giữ dạng nguyên mẫu.',
      'He/she/it + does not + động từ nguyên mẫu.'],
    [3, 'E03', '____ (do) your parents work on Saturdays?', 'Do', ['Does', 'Is', 'Doing'],
      'Your parents là chủ ngữ số nhiều. Câu hỏi hiện tại đơn với động từ thường bắt đầu bằng Do.',
      'Do + you/we/they hoặc chủ ngữ số nhiều + động từ nguyên mẫu?'],
    [4, 'E05', 'Where ____ (do) your sister practise the piano every week?', 'does', ['do', 'is', 'doing'],
      'Your sister là chủ ngữ số ít. Trong câu hỏi có where, đặt does trước chủ ngữ và giữ practise ở nguyên mẫu.',
      'Từ để hỏi + does + chủ ngữ số ít + động từ nguyên mẫu?'],
    [4, 'E05', 'How often ____ (do) the students visit the museum?', 'do', ['does', 'are', 'doing'],
      'The students là số nhiều nên câu hỏi how often dùng do. Visit giữ nguyên sau chủ ngữ.',
      'How often + do + chủ ngữ số nhiều + động từ nguyên mẫu?'],
    [4, 'E08', 'Hoa does not ____ (take) the bus to school.', 'take', ['takes', 'taking', 'took'],
      'Does đã mang dấu hiệu chia theo chủ ngữ Hoa. Động từ chính sau does not phải là take, không phải takes.',
      'Sau do/does hoặc do not/does not, dùng động từ nguyên mẫu.'],
    [5, 'E01', 'Each of these buses ____ (stop) outside our school every day.', 'stops', ['stop', 'stopping', 'are stopping'],
      'Chủ ngữ chính là each, không phải buses. Each được xem là số ít nên stop thêm -s thành stops.',
      'Each of + danh từ số nhiều dùng động từ số ít.'],
    [5, 'E02', 'I ____ (know) the answer to this question.', 'know', ['am knowing', 'knows', 'knowing'],
      'Know mô tả trạng thái hiểu biết. Trong nghĩa này, dùng hiện tại đơn know; không dùng am knowing.',
      'Động từ chỉ trạng thái như know thường không dùng ở dạng tiếp diễn trong nghĩa thông thường.'],
    [5, 'E01', 'The list of club activities ____ (be) on the noticeboard.', 'is', ['are', 'am', 'being'],
      'Danh từ trung tâm của chủ ngữ là list, số ít. Cụm of club activities không làm động từ chuyển sang số nhiều.',
      'Động từ hòa hợp với danh từ trung tâm của chủ ngữ, không phải danh từ trong cụm of.'],
  ],
  present_continuous: [
    [1, 'E03', 'I ____ (do) my geography homework right now.', 'am doing', ['doing', 'is doing', 'am do'],
      'Right now cho biết hành động đang diễn ra. Với I, cần am và động từ dạng -ing: am doing.',
      'I + am + V-ing để nói về hành động đang diễn ra.'],
    [1, 'E01', 'Look! Mai ____ (draw) a map of our neighbourhood.', 'is drawing', ['are drawing', 'is draw', 'drawing'],
      'Look! hướng sự chú ý vào hành động đang xảy ra. Mai là chủ ngữ số ít nên dùng is drawing.',
      'He/she/it hoặc chủ ngữ số ít + is + V-ing.'],
    [1, 'E01', 'The volunteers ____ (clean) the playground at the moment.', 'are cleaning', ['is cleaning', 'are clean', 'cleaning'],
      'The volunteers là số nhiều, còn at the moment chỉ thời điểm hiện tại. Cần dùng are cleaning.',
      'You/we/they hoặc chủ ngữ số nhiều + are + V-ing.'],
    [2, 'E07', 'Look! The puppy is ____ (run) across the garden.', 'running', ['runing', 'run', 'runs'],
      'Run có nguyên âm ngắn trước phụ âm cuối. Khi thêm -ing, gấp đôi n để được running.',
      'Run → running: gấp đôi phụ âm cuối trước -ing.'],
    [2, 'E07', 'My father is ____ (make) a sandwich right now.', 'making', ['makeing', 'make', 'makes'],
      'Make kết thúc bằng e câm. Bỏ e rồi thêm -ing để tạo making; sau is phải dùng dạng này.',
      'Động từ kết thúc bằng e câm thường bỏ e trước khi thêm -ing.'],
    [2, 'E07', 'The children are ____ (sit) on the carpet now.', 'sitting', ['siting', 'sit', 'sits'],
      'Sit có nguyên âm ngắn và phụ âm cuối t. Gấp đôi t rồi thêm -ing: sitting.',
      'Sit → sitting: gấp đôi phụ âm cuối trước -ing.'],
    [3, 'E06', 'Nam ____ (not read) a comic at the moment.', 'is not reading', ['does not reading', 'is not read', 'not reading'],
      'Phủ định hiện tại tiếp diễn với Nam dùng is not, theo sau là reading. Viết dạng đầy đủ theo yêu cầu bài.',
      'Chủ ngữ số ít + is not + V-ing.'],
    [3, 'E06', 'We ____ (not play) computer games right now.', 'are not playing', ['do not playing', 'are not play', 'is not playing'],
      'Với we, dùng are not để phủ định hành động đang diễn ra. Động từ play chuyển thành playing.',
      'You/we/they + are not + V-ing.'],
    [3, 'E05', '____ (be) the girls preparing lunch now?', 'Are', ['Is', 'Do', 'Does'],
      'The girls là số nhiều. Câu hỏi hiện tại tiếp diễn đảo Are lên trước chủ ngữ; preparing giữ phía sau.',
      'Are + chủ ngữ số nhiều + V-ing?'],
    [4, 'E05', 'What ____ (be) your brother building at the moment?', 'is', ['are', 'does', 'do'],
      'Your brother là chủ ngữ số ít. Trong câu hỏi hiện tại tiếp diễn, đặt is giữa what và chủ ngữ.',
      'Từ để hỏi + am/is/are + chủ ngữ + V-ing?'],
    [4, 'E05', 'Why ____ (be) you carrying so many books right now?', 'are', ['is', 'do', 'does'],
      'Chủ ngữ you đi với are. Carrying cho thấy cấu trúc tiếp diễn; không dùng do hoặc does trong câu này.',
      'Why + are + you + V-ing?'],
    [4, 'E02', 'Please speak quietly. The students ____ (study) in the next room now.', 'are studying', ['study', 'studies', 'studied'],
      'Yêu cầu nói nhỏ và từ now cho biết việc học đang diễn ra. The students là số nhiều nên dùng are studying.',
      'Dùng am/is/are + V-ing cho hành động đang xảy ra tại thời điểm nói.'],
    [5, 'E02', 'Lan usually cycles to school, but today she ____ (take) the bus.', 'is taking', ['takes', 'take', 'took'],
      'Usually cycles là thói quen. Vế but today nêu sự thay đổi tạm thời trong hiện tại nên dùng is taking.',
      'Hiện tại tiếp diễn có thể diễn tả tình huống tạm thời khác với thói quen hiện tại.'],
    [5, 'E07', 'Listen! Someone is ____ (knock) at the front door.', 'knocking', ['knockking', 'knock', 'knocks'],
      'Knock kết thúc bằng hai chữ cái phụ âm ck. Chỉ thêm -ing để được knocking; không thêm một chữ k nữa.',
      'Knock → knocking; không gấp đôi phụ âm khi từ đã kết thúc bằng một nhóm phụ âm.'],
    [5, 'E01', 'The woman with the two children ____ (wait) at the crossing right now.', 'is waiting', ['are waiting', 'is wait', 'waiting'],
      'Chủ ngữ chính là the woman, số ít. Cụm with the two children không thay đổi sự hòa hợp nên dùng is waiting.',
      'Am/is/are hòa hợp với danh từ trung tâm của chủ ngữ.'],
  ],
  past_simple: [
    [1, 'E04', 'Our team ____ (play) badminton after school yesterday.', 'played', ['play', 'plays', 'playing'],
      'Yesterday cho biết thời điểm đã qua. Play là động từ có quy tắc nên thêm -ed thành played.',
      'Động từ có quy tắc thường thêm -ed trong câu khẳng định quá khứ đơn.'],
    [1, 'E04', 'We ____ (visit) our grandparents last weekend.', 'visited', ['visit', 'visits', 'visiting'],
      'Last weekend là thời gian đã kết thúc. Quá khứ của visit là visited.',
      'Visit → visited; dùng quá khứ đơn cho sự việc hoàn tất trong quá khứ.'],
    [1, 'E02', 'The students ____ (clean) their classroom yesterday afternoon.', 'cleaned', ['clean', 'cleans', 'are cleaning'],
      'Yesterday afternoon xác định thời điểm trong quá khứ. Động từ clean có dạng quá khứ là cleaned.',
      'Dùng V-ed/V2 với mốc thời gian quá khứ đã kết thúc.'],
    [2, 'E04', 'My family ____ (go) to Da Lat last summer.', 'went', ['goed', 'go', 'goes'],
      'Go là động từ bất quy tắc, dạng quá khứ là went. Không tạo quá khứ bằng cách viết goed.',
      'Go → went là một dạng quá khứ bất quy tắc.'],
    [2, 'E04', 'I ____ (eat) noodles for breakfast yesterday.', 'ate', ['eated', 'eat', 'eats'],
      'Eat là động từ bất quy tắc, quá khứ là ate. Từ yesterday yêu cầu dùng dạng quá khứ trong câu này.',
      'Eat → ate; không thêm -ed cho động từ bất quy tắc này.'],
    [2, 'E04', 'Bao ____ (buy) a dictionary last Saturday.', 'bought', ['buyed', 'buy', 'buys'],
      'Buy có dạng quá khứ bất quy tắc là bought. Last Saturday là thời điểm đã qua.',
      'Buy → bought là một dạng quá khứ bất quy tắc.'],
    [3, 'E06', 'We ____ (not watch) the match last night.', 'did not watch', ['did not watched', 'do not watch', 'not watched'],
      'Câu phủ định quá khứ đơn dùng did not. Sau did not, watch trở về dạng nguyên mẫu; viết dạng đầy đủ.',
      'Chủ ngữ + did not + động từ nguyên mẫu.'],
    [3, 'E06', 'An ____ (not go) swimming yesterday.', 'did not go', ['did not went', 'does not go', 'not went'],
      'Did not đã thể hiện thì quá khứ, nên động từ chính phải là go thay vì went. Viết dạng đầy đủ theo yêu cầu.',
      'Sau did not, dùng động từ nguyên mẫu kể cả với động từ bất quy tắc.'],
    [3, 'E03', '____ (do) your sister finish her project last night?', 'Did', ['Does', 'Do', 'Doing'],
      'Last night chỉ thời gian quá khứ. Câu hỏi dùng Did cho mọi chủ ngữ; finish giữ dạng nguyên mẫu.',
      'Did + chủ ngữ + động từ nguyên mẫu?'],
    [4, 'E05', 'Where ____ (do) your cousins stay during their holiday last month?', 'did', ['does', 'do', 'are'],
      'Last month đặt sự việc trong quá khứ. Trong câu hỏi where, dùng did trước chủ ngữ rồi đến stay nguyên mẫu.',
      'Từ để hỏi + did + chủ ngữ + động từ nguyên mẫu?'],
    [4, 'E01', 'The classrooms ____ (be) empty yesterday morning.', 'were', ['was', 'are', 'is'],
      'The classrooms là chủ ngữ số nhiều. Quá khứ của be với chủ ngữ số nhiều là were.',
      'Quá khứ của be: you/we/they và chủ ngữ số nhiều dùng were.'],
    [4, 'E01', 'My younger brother ____ (be) ill last Monday.', 'was', ['were', 'is', 'are'],
      'My younger brother là ngôi thứ ba số ít. Với mốc last Monday, dùng was, không dùng is hoặc were.',
      'Quá khứ của be: I/he/she/it và chủ ngữ số ít dùng was.'],
    [5, 'E04', 'Our science teacher ____ (teach) us about magnets last week.', 'taught', ['teached', 'teach', 'teaches'],
      'Teach là động từ bất quy tắc có dạng quá khứ taught. Không dùng teached dù đó là dạng thường dễ đoán nhầm.',
      'Teach → taught là một dạng quá khứ bất quy tắc.'],
    [5, 'E04', 'The last bus ____ (leave) the station at nine yesterday evening.', 'left', ['leaved', 'leave', 'leaves'],
      'Yesterday evening chỉ thời gian quá khứ. Leave có dạng quá khứ bất quy tắc là left.',
      'Leave → left; dùng dạng V2 trong câu khẳng định quá khứ đơn.'],
    [5, 'E08', 'Did the members of your club ____ (collect) litter last Sunday?', 'collect', ['collected', 'collects', 'collecting'],
      'Did ở đầu câu đã biểu thị thì quá khứ. Động từ sau cụm chủ ngữ dài vẫn phải là collect nguyên mẫu.',
      'Sau did trong câu hỏi, dùng động từ nguyên mẫu, không dùng V-ed/V2.'],
  ],
};

const tenseLabels = {
  present_simple: 'present simple',
  present_continuous: 'present continuous',
  past_simple: 'past simple',
};

export const curriculumQuestions = Object.entries(lessons).flatMap(([tense, rows]) =>
  rows.flatMap(([difficulty, errorCode, sentence, correctAnswer, distractors, explanationVi, grammarRule], index) => {
    const plainSentence = sentence.replace(/____\s*\([a-z]+(?:[ '-][a-z]+)*\)/i, '____');
    const options = [{ text: correctAnswer, errorCode: null }, ...distractors.map(text => ({ text, errorCode: null }))];
    const offset = index % options.length;
    const common = { tense, difficulty, errorCode, explanationVi,
      grammarRule: `${grammarRule} (Học liệu khởi đầu được biên soạn với AI hỗ trợ.)` };
    return [
      { ...common, questionType: 'multiple_choice',
        content: `Choose the correct form in the ${tenseLabels[tense]}: ${plainSentence}`,
        correctAnswer, options: [...options.slice(offset), ...options.slice(0, offset)] },
      { ...common, questionType: 'fill_in_blank',
        content: `Use the ${tenseLabels[tense]} and full forms: ${sentence}`,
        correctAnswer, options: [] },
      { ...common, questionType: 'error_correction',
        content: `Correct the verb phrase using the ${tenseLabels[tense]} and full forms: ${plainSentence.replace('____', distractors[0])}`,
        correctAnswer: plainSentence.replace('____', correctAnswer), options: [] },
    ];
  }));

export function validateCurriculum(domain, questions = curriculumQuestions) {
  const hashes = new Set();
  for (const question of questions) {
    domain.validateBatch({ questions: [question] }, {
      tense: question.tense, difficulty: question.difficulty,
      questionType: question.questionType, count: 1, modelTier: 'primary',
    });
    const digest = domain.contentHash(question);
    if (hashes.has(digest)) throw new Error('Curriculum contains duplicate question content');
    hashes.add(digest);
  }
}

export async function seedCurriculum(db, domain, questions = curriculumQuestions) {
  // Validate the entire pack before any writes, then commit all new questions together.
  validateCurriculum(domain, questions);
  await domain.seedTaxonomy(db);
  return db.$transaction(async tx => {
    const existing = await tx.question.findMany({
      where: { contentHash: { in: questions.map(domain.contentHash) } },
      select: { contentHash: true },
    });
    const hashes = new Set(existing.map(question => question.contentHash));
    let added = 0;
    for (const question of questions) {
      const digest = domain.contentHash(question);
      if (hashes.has(digest)) continue;
      const { options, ...fields } = question;
      await tx.question.create({ data: {
        ...fields, contentHash: digest, skillId: `${question.tense}:${question.errorCode}`,
        provenance: 'ai_assisted_curriculum', model: 'codex-authored',
        promptVersion: curriculumVersion, createdBy: curriculumAuthor, status: 'draft',
        reviewFlags: JSON.stringify(['ai_assisted_authorship', 'teacher_grammar_review_required',
          'single_answer_semantics_unverified', 'difficulty_not_calibrated']),
        options: { create: options.map((option, position) => ({ ...option, position })) },
      } });
      added++;
    }
    return { version: curriculumVersion, added, skipped: existing.length, total: questions.length };
  }, { timeout: 30000 });
}

export async function importCurriculum(apiUrl, token, domain, {
  dryRun = false, fetcher = globalThis.fetch, questions = curriculumQuestions,
} = {}) {
  validateCurriculum(domain, questions);
  const origin = new URL(apiUrl);
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') {
    throw new Error('Use an API origin such as https://tenselab.example.com, without a path or credentials.');
  }
  if (origin.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)) {
    throw new Error('Use HTTPS when sending a staff access code to a remote server.');
  }
  const request = async (path, body) => {
    const response = await fetcher(`${origin.origin}/api/v1${path}`, {
      method: body ? 'POST' : 'GET', redirect: 'error',
      headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: globalThis.AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`Curriculum API request failed (${response.status}) at ${path}. Re-running skips existing questions.`);
    return response.json();
  };
  const session = await request('/auth/session');
  if (!['admin', 'teacher'].includes(session.role)) throw new Error('A teacher or administrator access code is required.');
  const batches = [];
  let ready = 0;
  for (let offset = 0; offset < questions.length; offset += 50) {
    const batch = questions.slice(offset, offset + 50);
    const preview = await request('/questions/import/preview', { questions: batch });
    if (preview.invalidCount) throw new Error('The server rejected a question during preview; nothing has been imported.');
    ready += preview.readyCount;
    batches.push(batch);
  }
  if (dryRun) return { version: curriculumVersion, total: questions.length, ready, skipped: questions.length - ready, databaseChanged: false };
  let added = 0;
  let skipped = 0;
  for (const batch of batches) {
    const result = await request('/questions/import', { questions: batch, skipDuplicates: true });
    added += result.questions.length;
    skipped += result.skipped;
  }
  return { version: curriculumVersion, total: questions.length, added, skipped, source: 'teacher_import', status: 'draft' };
}

async function main() {
  const args = process.argv.slice(2);
  let apiUrl;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--api-url' && args[i + 1] && !args[i + 1].startsWith('--')) apiUrl = args[++i];
    else if (!['--dry-run', '--help'].includes(args[i])) throw new Error('Supported options: --api-url <origin>, --dry-run, --help');
  }
  if (args.includes('--help')) {
    console.log('Load 135 original AI-assisted grammar exercises as drafts. Re-running skips existing content.');
    console.log('Use --dry-run to validate without opening or modifying a database.');
    console.log('Use --api-url <origin> to import through a deployed API with your configured teacher/staff access code.');
    return;
  }
  const domain = await import(pathToFileURL(resolve('dist/src/domain.js')).href);
  validateCurriculum(domain);
  const coverage = Object.fromEntries(Object.keys(lessons).map(tense => [tense,
    curriculumQuestions.filter(question => question.tense === tense).length]));
  if (apiUrl) {
    const { loadConfig } = await import(pathToFileURL(resolve('dist/src/config.js')).href);
    const staff = JSON.parse(loadConfig().AUTH_CREDENTIALS_JSON);
    const token = process.env.CURRICULUM_IMPORT_TOKEN
      ?? staff.find(credential => credential.role === 'teacher')?.token
      ?? staff.find(credential => credential.role === 'admin')?.token;
    if (!token) throw new Error('Configure a teacher/staff access code or CURRICULUM_IMPORT_TOKEN.');
    console.log(JSON.stringify({ ...await importCurriculum(apiUrl, token, domain, { dryRun: args.includes('--dry-run') }), coverage }));
    if (!args.includes('--dry-run')) console.log('Imported exercises are drafts. Review them as an administrator in the question bank.');
    return;
  }
  if (args.includes('--dry-run')) {
    console.log(JSON.stringify({ version: curriculumVersion, total: curriculumQuestions.length, coverage, databaseChanged: false }));
    return;
  }
  const { loadConfig } = await import(pathToFileURL(resolve('dist/src/config.js')).href);
  const { createDb } = await import(pathToFileURL(resolve('dist/src/db.js')).href);
  const db = createDb(loadConfig().DATABASE_URL);
  try {
    console.log(JSON.stringify({ ...await seedCurriculum(db, domain), coverage }));
    console.log('New exercises are drafts. Log in as an administrator and review them in the question bank before students practise.');
  } finally {
    await db.$disconnect();
  }
}

// No writes when imported by a test or another script. Also supports node's stdin mode.
const modulePath = fileURLToPath(import.meta.url);
const isStdinEntry = (!process.argv[1] || process.argv[1] === '-') && modulePath === resolve('[eval1]');
if (isStdinEntry || (process.argv[1] && resolve(process.argv[1]) === modulePath)) {
  try { await main(); }
  catch (error) {
    // Do not print ORM connection details, environment variables or credentials.
    console.error(error instanceof Error && !('code' in error)
      ? error.message : 'Curriculum import failed; check database access and migrations, then retry.');
    process.exitCode = 1;
  }
}
