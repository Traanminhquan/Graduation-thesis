/** Offline only: injected read-only delegates, deterministic fixtures, no Prisma construction. */
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WeaknessView } from "../src/components/progress/weakness-section";
import { WEAKNESS_THRESHOLDS as T, detectAttempts, detectAssessments, normaliseErrorType, validSuggestions, compareItems, topPriorities, matchLesson, matchPrompt, getWeaknessOverview, DIMENSIONS, type Attempt, type Assessment, type Item, type Catalogue, type WeaknessDb } from "../src/lib/progress/weakness";
let networkCalls = 0;
globalThis.fetch = (() => { networkCalls++; throw new Error("Network forbidden"); }) as typeof fetch;
const date = (n: number) => new Date(Date.UTC(2026,0,n));
function attempt(id: string, wrong: number, total: number, day = 1, type = "MATCHING", score = 100, maxScore = 100): Attempt {
  return {id,lessonId:`lesson-${id}`,completedAt:date(day),score,maxScore,answers:Array.from({length:total},(_,i) => ({isCorrect:i>=wrong,question:{type}}))};
}
function correction(errorType = "Subject-Verb Agreement", original = "I is") { return {errorType,original,corrected:"I am",explanation:"Stored explanation"}; }
function assessment(id: string, day = 1, corrections: unknown = [correction()], score = 100): Assessment {
  return {id,assessedAt:date(day),corrections,suggestions:["Stored suggestion"],overallScore:score,grammarScore:score,vocabularyScore:score,coherenceScore:score,taskAchievementScore:score,topicRelevanceScore:score,submission:{id:`submission-${id}`,promptId:`prompt-${id}`,finalText:"I is learning",confirmedTranscript:"I is learning"}};
}
const observed = (rows: Attempt[]) => detectAttempts("listening",rows).filter(i => i.kind !== "low-score");
const kinds = (rows: Attempt[]) => observed(rows).map(i => i.kind);
assert.deepEqual(T, {attemptWindow:20,assessmentWindow:10,answers:3,attempts:2,wrong:2,errorPercent:40,earlyAnswers:2,earlyWrong:1,submissions:2,scoreSamples:2,lowScore:60,perSkill:3,priorities:5,catalogue:200,submittedPrompts:50,suggestions:2,suggestionLength:300,errorKeyLength:60});
assert.deepEqual(kinds([attempt("a",1,1)]),[]);
assert.deepEqual(kinds([attempt("a",1,2)]),["early"]);
assert.deepEqual(kinds([attempt("a",2,2)]),["early"]);
assert.deepEqual(kinds([attempt("a",3,3)]),["early"]);
assert.deepEqual(kinds([attempt("a",1,2),attempt("b",0,1)]),["early"]);
assert.deepEqual(kinds([attempt("a",1,2),attempt("b",1,1)]),["recurring"]);
assert.deepEqual(kinds([attempt("a",1,3),attempt("b",1,2)]),["recurring"]);
assert.deepEqual(kinds([attempt("a",20,50),attempt("b",19,50)]),["early"]);
assert.deepEqual(kinds([attempt("a",20,50),attempt("b",20,50)]),["recurring"]);
for (const skill of ["reading","listening"] as const) {
  const low = (scores: number[]) => detectAttempts(skill,scores.map((s,i) => attempt(String(i),0,0,i+1,"MATCHING",s))).filter(i => i.kind === "low-score");
  assert.equal(low([20]).length,0);
  assert.equal(low([59,60]).length,1);
  assert.equal(low([60,60]).length,0);
  assert.equal(low([0,0])[0].evidence,`Average 0% over your last 2 ${skill === "reading" ? "Reading" : "Listening"} attempts`);
  assert.equal(detectAttempts(skill,[attempt("a",0,0,1,"MATCHING",0,0),attempt("b",0,0,2,"MATCHING",0)]).length,0);
}
for (const skill of ["writing","speaking"] as const) {
  assert.equal(detectAssessments(skill,[assessment("a",1,[correction(),correction()])]).length,0);
  const twice = detectAssessments(skill,[assessment("a",1,[correction(),correction(" subject verb agreement ")]),assessment("b",2,[correction("subject_verb_agreement!")])]);
  assert.equal(twice.length,1); assert.equal(twice[0].count,2); assert.equal(twice[0].wrong,3);
  assert.equal(twice[0].title,"Subject verb agreement"); assert.equal(twice[0].key,"subject_verb_agreement");
  assert.equal(twice[0].example?.original,"I is");
  const bad = assessment("b",2); bad.submission.finalText="Different text"; bad.submission.confirmedTranscript="Different text";
  assert.equal(detectAssessments(skill,[assessment("a"),bad])[0].example,undefined);
  const duplicate = assessment("b",2); duplicate.submission.id="submission-a";
  assert.equal(detectAssessments(skill,[assessment("a"),duplicate]).length,0);
  const lows = (s: number) => detectAssessments(skill,[assessment("a",1,[],s),assessment("b",2,[],s)]);
  assert.equal(lows(59.9).length,4); assert.equal(lows(60).length,0);
  assert.deepEqual(lows(59.9).map(i => i.title).sort(), (skill === "writing" ? ["Low grammar scores","Low vocabulary scores","Low coherence scores","Low task achievement scores"] : ["Low topic relevance scores","Low grammar scores","Low vocabulary scores","Low coherence scores"]).sort());
  assert(lows(59.9).every(i => !/subject|agreement|Matching/.test(i.evidence)));
  assert.deepEqual(lows(59.9)[0].suggestions,["Stored suggestion"]);
  const malformed: unknown[] = [null,{},"bad",[null,{},correction(""),{...correction(),explanation:" "},{...correction(),original:2}]];
  for (const value of malformed) assert.equal(detectAssessments(skill,[assessment("a",1,value),assessment("b",2,value)]).length,0);
  const tiedA=assessment("a",2,[correction("x","I is")]);
  const tiedB=assessment("b",2,[correction("x","missing")]);
  assert.equal(detectAssessments(skill,[tiedB,tiedA])[0].example?.original,"I is");
  const old = assessment("old",1,[correction()],0);
  const fresh = Array.from({length:10},(_,i) => assessment(String(i),i+2,[]));
  assert.deepEqual(detectAssessments(skill,[old,...fresh]),[]);
  assert.deepEqual(detectAssessments(skill,[...fresh,old].reverse()),[]);
  // Window: two OLD assessments sharing an error type must not become a recurring weakness once ten newer assessments exist.
  const olds = [assessment("o1",1,[correction()]),assessment("o2",1,[correction()])];
  assert.deepEqual(detectAssessments(skill,[...olds,...fresh]),[]);
  assert.equal(detectAssessments(skill,[...olds,...fresh.slice(0,8)]).length,1);
  // Suggestions come from the MOST RECENT assessment.
  const newest = {...assessment("n",20,[],40),suggestions:["Latest tip"]}, older = {...assessment("m",10,[],40),suggestions:["Older tip"]};
  assert.deepEqual(detectAssessments(skill,[older,newest])[0].suggestions,["Latest tip"]);
  assert.deepEqual(detectAssessments(skill,[newest,older])[0].suggestions,["Latest tip"]);
}
assert.deepEqual(DIMENSIONS,{writing:["grammar","vocabulary","coherence","taskAchievement"],speaking:["topicRelevance","grammar","vocabulary","coherence"]});
assert.equal(normaliseErrorType(" Subject-Verb Agreement! "),"subject_verb_agreement");
assert.equal(normaliseErrorType("!!!"),null); assert.equal(normaliseErrorType("a".repeat(61)),null); assert.equal(normaliseErrorType("a".repeat(60)),"a".repeat(60));
assert.deepEqual(validSuggestions(["good",4]),[]); assert.deepEqual(validSuggestions(null),[]);
assert.deepEqual(validSuggestions(["a".repeat(400),"b","c"]),["a".repeat(300),"b"]);
const early = observed([attempt("a",1,2)])[0];
assert.equal(early.kind,"early"); assert(!/weakness/i.test(JSON.stringify(early))); assert.deepEqual(topPriorities([early]),[]);
const base = observed([attempt("a",1,2),attempt("b",1,1)])[0];
function rank(a: Partial<Item>,b: Partial<Item>) { assert(compareItems({...base,...a},{...base,...b})<0); }
rank({numerator:2,denominator:3},{numerator:3,denominator:5});
rank({numerator:4,denominator:6,wrong:4},{numerator:2,denominator:3,wrong:2});
rank({recency:2},{recency:1}); rank({key:"a"},{key:"b"});
rank({kind:"recurring"},{kind:"low-score"}); rank({kind:"low-score"},{kind:"early"});
rank({kind:"low-score",numerator:50,denominator:1},{kind:"low-score",numerator:59,denominator:1});
rank({kind:"low-score",numerator:100,denominator:2,count:2},{kind:"low-score",numerator:50,denominator:1,count:1});
rank({skill:"writing",count:3},{skill:"writing",count:2});
rank({skill:"writing",wrong:4},{skill:"writing",wrong:3});
rank({skill:"writing",recency:3},{skill:"writing",recency:2});
rank({skill:"speaking",key:"a"},{skill:"speaking",key:"b"});
rank({kind:"low-score",recency:3},{kind:"low-score",recency:2});
rank({kind:"low-score",key:"a"},{kind:"low-score",key:"b"});
const priorityPair = (a: Partial<Item>, b: Partial<Item>) => {
  const first = {...base,...a}; const second = {...base,...b};
  assert.deepEqual(topPriorities([second,first]),[first,second]);
};
priorityPair({kind:"recurring",numerator:1,denominator:2},{kind:"low-score",numerator:0,denominator:1});
priorityPair({numerator:2,denominator:3},{numerator:3,denominator:5});
priorityPair({count:4},{count:3});
priorityPair({recency:3},{recency:2});
priorityPair({skill:"reading"},{skill:"writing"});
priorityPair({key:"a"},{key:"b"});
priorityPair({kind:"low-score",numerator:50,denominator:1},{kind:"low-score",numerator:59,denominator:1}); // lower mean is more severe
const lots = Array.from({length:8},(_,i) => ({...base,key:String(i),skill:"reading" as const}));
assert.equal(topPriorities([...lots,early]).length,5); assert.deepEqual(topPriorities(lots),topPriorities([...lots].reverse()));
const freshAttempts=Array.from({length:20},(_,i)=>attempt(String(i),0,1,i+2));
assert.deepEqual(observed([attempt("old",100,100),...freshAttempts]),[]);
assert.deepEqual(observed([{...attempt("inprogress",100,100),completedAt:null},...freshAttempts]),[]);
// An in-progress attempt must not count even when the window is not full.
assert.deepEqual(observed([{...attempt("inprogress",5,5),completedAt:null},attempt("done",0,5)]),[]);
const cat: Catalogue[] = [ {id:"z",title:"Advanced",difficulty:"ADVANCED",questions:[{type:"MATCHING"}]}, {id:"b",title:"Beginner B",difficulty:"BEGINNER",questions:[{type:"MATCHING"}]}, {id:"a",title:"Beginner A",difficulty:"BEGINNER",questions:[{type:"MATCHING"}]}, {id:"wrong",title:"Wrong type",difficulty:"BEGINNER",questions:[{type:"TRUE_FALSE"}]} ];
assert.equal(matchLesson("listening",base,cat,[])?.href,"/listening/a");
assert.equal(matchLesson("listening",base,cat,[{...attempt("1",0,0),lessonId:"a"}])?.href,"/listening/b");
const attempted=cat.map((c,i)=>({...attempt(String(i),0,0,i+1,"MATCHING",[80,40,60,1][i]),lessonId:c.id}));
assert.equal(matchLesson("listening",base,cat,attempted)?.href,"/listening/b");
assert.equal(matchLesson("listening",base,cat,[...attempted,{...attempt("new",0,0,20,"MATCHING",90),lessonId:"b"}])?.href,"/listening/a");
assert.equal(matchLesson("listening",base,cat,[...attempted,{...attempt("unscored",0,0,20,"MATCHING",0,0),lessonId:"b"}])?.href,"/listening/b");
assert.equal(matchLesson("reading",base,[],[]),undefined);
assert.equal(matchLesson("reading",undefined,cat,[])?.href,"/reading/a");
assert.equal(matchPrompt("writing",cat,["a","b","wrong"],[])?.href,"/writing/z");
assert.match(matchPrompt("writing",cat,[],[])!.reason,/General additional practice; prompts are not tagged/);
const scored=cat.map((c,i)=>({...assessment(String(i),i+1,[],[80,40,60,90][i]),submission:{id:String(i),promptId:c.id}}));
assert.equal(matchPrompt("speaking",cat,cat.map(c=>c.id),scored)?.href,"/speaking/b");
assert.equal(matchPrompt("speaking",cat,cat.map(c=>c.id),scored,true),undefined);
assert.equal(matchPrompt("writing",[],[],[]),undefined);

// Faithful bounded fake: applies filters/order/take and select recursively.
type Row = Record<string, unknown>;
type Query = {where?: Row; orderBy?: Row | Row[]; take?: number; select?: Row};
function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key,value]) => {
    if (value && typeof value === "object") {
      if ("not" in value) return row[key] !== (value as {not:unknown}).not;
      return !!row[key] && matches(row[key] as Row,value as Row);
    }
    return row[key] === value;
  });
}
function select(row: Row, fields?: Row): Row {
  if (!fields) return row;
  return Object.fromEntries(Object.entries(fields).map(([key,value]) => [key,value === true ? row[key] : Array.isArray(row[key]) ? (row[key] as Row[]).map(r=>select(r,(value as {select:Row}).select)) : row[key] ? select(row[key] as Row,(value as {select:Row}).select) : row[key]]));
}
function fake(tables: Record<string, Row[]>) {
  const calls: {name:string;query:Query}[]=[]; const events:string[]=[]; let active=false;
  const db = new Proxy({}, {get(_target,name:string) {
    assert(["readingAttempt","listeningAttempt","writingAssessment","speakingAssessment","readingLesson","listeningLesson","writingPrompt","speakingPrompt","writingSubmission","speakingSubmission"].includes(name),`Forbidden delegate ${name}`);
    return new Proxy({}, {get(_delegate,method:string) {
      assert(["findMany","findFirst"].includes(method),`Forbidden method ${method}`);
      return async (query: Query) => {
        assert(!active,"Overlapping database calls"); active=true; events.push(`start:${name}`);calls.push({name,query});
        try {
          await Promise.resolve();
          assert.equal(typeof query.take,"number");
          let rows = (tables[name] ?? []).filter(r=>matches(r,query.where ?? {}));
          const order = Array.isArray(query.orderBy) ? query.orderBy : [query.orderBy ?? {}];
          rows = [...rows].sort((a,b)=>{for(const clause of order)for(const [key,direction] of Object.entries(clause)){const x=a[key] as string|number|Date;const y=b[key] as string|number|Date;const d=x<y?-1:x>y?1:0;if(d)return direction === "desc"?-d:d;}return 0;});
          return rows.slice(0,query.take).map(r=>select(r,query.select));
        } finally {events.push(`finish:${name}`);active=false;}
      };
    }});
  }}) as WeaknessDb;
  return {db,calls,events};
}
const own = (r: Attempt): Row => ({...r,userId:"owner"});
const ownAssessment = (r: Assessment): Row => ({...r,submission:{...r.submission,userId:"owner"}});
async function integration() {
  const tables: Record<string,Row[]> = {
    readingAttempt:[own(attempt("a",2,3,3,"MAIN_IDEA",40)),own(attempt("b",2,3,2,"MAIN_IDEA",40)),{...own(attempt("foreign",40,40,30,"SECRET_OTHER_USER")),userId:"other"}, {...own(attempt("draft",40,40)),completedAt:null}],
    listeningAttempt:[],writingAssessment:[ownAssessment(assessment("a",1,undefined,40)),ownAssessment(assessment("b",2,undefined,40)),{...ownAssessment(assessment("other",30,[correction("SECRET_OTHER_USER","SECRET_OTHER_TEXT")],0)),submission:{id:"foreign",promptId:"foreign",userId:"other",finalText:"SECRET_OTHER_TEXT"}}],speakingAssessment:[],
    readingLesson:cat.map(c=>({...c,questions:[{type:"MAIN_IDEA"}]})),listeningLesson:cat,writingPrompt:cat,speakingPrompt:cat,
    writingSubmission:[{userId:"owner",status:"DRAFT",promptId:"a",submittedAt:date(4)},{userId:"other",status:"SUBMITTED",promptId:"a",submittedAt:date(4)}],speakingSubmission:[],
  };
  const f=fake(tables); const overview=await getWeaknessOverview("owner",f.db);
  assert.equal(f.calls.length,10); assert(f.calls.length<=10);
  assert.deepEqual(f.calls.slice(0,4).map(c=>c.name),["readingAttempt","listeningAttempt","writingAssessment","speakingAssessment"]);
  for(let i=0;i<f.events.length;i+=2) assert.equal(f.events[i].replace("start:",""),f.events[i+1].replace("finish:",""));
  for (const c of f.calls.filter(c=>/Attempt|Assessment|Submission/.test(c.name))) {assert(c.query.take);assert.equal(/Assessment/.test(c.name)?(c.query.where?.submission as Row).userId:c.query.where?.userId,"owner");}
  for (const c of f.calls.filter(c=>/Attempt$/.test(c.name))) {assert.deepEqual(c.query.where?.completedAt,{not:null});assert.equal(c.query.take,20);}
  for (const c of f.calls.filter(c=>/Assessment$/.test(c.name))) assert.equal(c.query.take,10);
  assert(overview.skills.every(c=>c.items.length<=3));assert(overview.priorities.length<=5);assert(overview.priorities.every(i=>i.kind!=="early"));
  assert.equal(overview.skills[0].status,"confirmed"); assert.equal(overview.skills[1].status,"insufficient");
  assert.equal(overview.skills[2].items[0].recommendation?.href,"/writing/a");
  assert.equal(overview.skills[2].items.length,3);
  assert.deepEqual(overview.skills[2].items.map(i=>i.kind),["recurring","low-score","low-score"]);
  for (const card of overview.skills) for (const i of card.items) if(i.recommendation) assert(tables[`${card.skill}${card.skill === "reading" || card.skill === "listening" ? "Lesson" : "Prompt"}`].some(c=>i.recommendation!.href===`/${card.skill}/${c.id}`));
  assert(!/SECRET_OTHER/.test(JSON.stringify(overview)));
  const shuffled=fake(Object.fromEntries(Object.entries(tables).map(([k,v])=>[k,[...v].reverse()])));
  assert.deepEqual(await getWeaknessOverview("owner",shuffled.db),overview);
  const html=renderToStaticMarkup(createElement(WeaknessView,{overview}));
  const vietnamese = await getWeaknessOverview("owner", fake(tables).db, "vi");
  const vietnameseHtml = renderToStaticMarkup(createElement(WeaknessView, { overview: vietnamese, locale: "vi" }));
  for (const text of ["Nên tập trung vào đâu", "Ưu tiên hàng đầu", "Lỗi lặp lại", "Điểm thấp", "Hiển thị vì:", "Luyện tập:", "Nói (chỉ nội dung)", "Cách tính"]) assert(vietnameseHtml.includes(text), text);
  assert.deepEqual(vietnamese.priorities.map(i => [i.skill, i.key, i.kind, i.numerator, i.denominator, i.recommendation?.href, i.recommendation?.title]), overview.priorities.map(i => [i.skill, i.key, i.kind, i.numerator, i.denominator, i.recommendation?.href, i.recommendation?.title]));
  assert.deepEqual(vietnamese.skills[2].items[0].example, overview.skills[2].items[0].example);
  assert.deepEqual(vietnamese.skills[2].items[1].suggestions, overview.skills[2].items[1].suggestions);
  for(const text of ["Where to focus next","Top priorities","Recurring mistake","Low scores","Shown because:","Practise:","Speaking (content only)","AI assessment is requested","Not enough evidence yet","How this is calculated",`latest ${T.attemptWindow} completed`,`latest ${T.assessmentWindow} assessments`,`at least ${T.answers} answers`,`${T.errorPercent}% or more wrong`]) assert(html.includes(text),text);
  assert(html.includes("<details")); assert(!/SECRET_OTHER|pronunciation|accent|intonation|fluency|pacing/i.test(html));
  const empty=await getWeaknessOverview("nobody",fake(tables).db);
  assert(empty.skills.every(c=>c.status==="insufficient"&&c.items.length===0));assert.equal(empty.priorities.length,0);
  assert.equal(empty.skills[0].shortfall,"2 more completed attempts are needed to look for patterns");
  // Neutral starting points (easiest unattempted lesson/prompt, id order) for learners without evidence.
  assert.deepEqual(empty.skills.map(c=>c.startingPoint?.href),["/reading/a","/listening/a","/writing/a","/speaking/a"]);
  // Speaking is analysed from SPEAKING assessments only (not from Writing ones).
  const speakingOnly=await getWeaknessOverview("owner",fake({speakingAssessment:[ownAssessment(assessment("s1",1,[correction("Word order","I is")])),ownAssessment(assessment("s2",2,[correction("word-order","I is")]))],speakingPrompt:cat}).db);
  assert.equal(speakingOnly.skills[3].items[0].key,"word_order"); assert(/content only/.test(speakingOnly.skills[3].items[0].evidence));
  assert.equal(speakingOnly.skills[2].items.length,0); assert.equal(speakingOnly.skills[2].status,"insufficient");
  const little=await getWeaknessOverview("owner",fake({readingAttempt:[own(attempt("one",1,2))]}).db);
  assert.equal(little.skills[0].shortfall,"1 more completed attempt is needed to look for patterns");
  assert.equal(little.skills[0].items[0].kind,"early");assert.equal(little.priorities.length,0);
  assert.equal(little.skills[0].status,"insufficient"); // an early signal is not a confirmed weakness
  const littleHtml=renderToStaticMarkup(createElement(WeaknessView,{overview:little})); assert(littleHtml.includes("Early signal: not enough evidence yet"));
  assert(little.skills.slice(1).every(c=>c.status==="insufficient"));
  const manyTypes = ["MULTIPLE_CHOICE","TRUE_FALSE","FILL_BLANK","MAIN_IDEA"].flatMap((type,i)=>[own(attempt(`${type}-a`,1,2,i+1,type)),own(attempt(`${type}-b`,1,1,i+2,type))]);
  const capped=await getWeaknessOverview("owner",fake({readingAttempt:[...manyTypes,own(attempt("early",1,2,20,"VOCAB_IN_CONTEXT"))]}).db);
  assert.equal(capped.skills[0].items.length,3);
  assert(capped.skills[0].items.every(i=>i.kind==="recurring"));
  assert(capped.skills[0].items.every(i=>i.recommendation===undefined));
  assert.equal(capped.priorities.length,4);
  // Bounded query regression: old rows and in-progress answers cannot affect output.
  const windowFake=fake({readingAttempt:[...freshAttempts.map(own),own(attempt("old",99,99)),{...own(attempt("progress",99,99,30)),completedAt:null}],writingAssessment:Array.from({length:10},(_,i)=>ownAssessment(assessment(String(i),i+2,[]))).concat([ownAssessment(assessment("old",1,undefined,0))])});
  const bounded=await getWeaknessOverview("owner",windowFake.db); assert.equal(bounded.skills[0].items.length,0);assert.equal(bounded.skills[2].items.length,0);
  assert.throws(()=>Reflect.get(f.db,"$transaction")); assert.throws(()=>Reflect.get(f.db.readingAttempt,"create"));
  // Presentation: question types get their proper names (unknown types are only humanised, never invented), the example uses an arrow, plurals are correct.
  for (const [type,label] of [["TRUE_FALSE","True / False"],["FILL_BLANK","Fill in the blank"],["VOCAB_IN_CONTEXT","Vocabulary in context"],["MULTIPLE_CHOICE","Multiple choice"],["MAIN_IDEA","Main idea"],["MATCHING","Matching"],["WEIRD_TYPE","Weird type"]] as const) {
    const item = detectAttempts("reading",[attempt("a",1,2,1,type)])[0];
    assert.equal(item.title,label); assert(item.evidence.includes(`${label} questions answered wrongly`));
  }
  assert.match(html,/I is[\s\S]*→[\s\S]*I am/);
  assert.equal((await getWeaknessOverview("owner",fake({writingAssessment:[ownAssessment(assessment("only"))]}).db)).skills[2].shortfall,"1 more AI-assessed submission is needed to look for patterns");
  assert.equal(networkCalls,0);
  console.log("PASS weakness thresholds, grouping, ranking, windows, recommendations, isolation, sequential bounded reads and rendered UI (offline)");
}
integration().catch(error=>{console.error(error);process.exitCode=1;});
