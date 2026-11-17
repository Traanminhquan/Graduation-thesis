import type { ReadingBankLesson, ReadingItem, ReadingKind } from "./lesson-bank-data";

// Authors supply the correct choice first; rotation spreads its displayed position.
function choice(type: ReadingKind, prompt: string, options: string[], explanation: string, position: number): ReadingItem {
  const answer = options[0];
  const arranged = options.slice(1);
  arranged.splice(position, 0, answer);
  return { type, prompt, options: arranged, answer, explanation };
}
const mc = (prompt: string, options: string[], explanation: string, p: number) => choice("MULTIPLE_CHOICE", prompt, options, explanation, p);
const main = (options: string[], explanation: string, p: number) => choice("MAIN_IDEA", "What is the passage mainly about?", options, explanation, p);
const vocab = (word: string, options: string[], explanation: string, p: number) => choice("VOCAB_IN_CONTEXT", `In the passage, "${word}" means:`, options, explanation, p);
const tf = (prompt: string, answer: "true" | "false", explanation: string): ReadingItem => ({ type: "TRUE_FALSE", prompt, answer, explanation });
const blank = (prompt: string, answer: string, explanation: string): ReadingItem => ({ type: "FILL_BLANK", prompt, answer, explanation });

export const readingLessons3: ReadingBankLesson[] = [
  {
    id: "seed-reading-25", title: "Poma's Morning Walk", topic: "Neighbours and animals", cefr: "A1", difficulty: "BEGINNER", estimatedMinutes: 4,
    summary: "Three neighbours share their days with the same cat.",
    content: `Poma is a small white cat. She lives with Vina in a red house. Every morning, Vina gives her food and water. Then Poma goes out through the kitchen door. She walks to the house next door. A boy called Rem sits there with a book. Poma sits near his feet.

At twelve, Poma goes to a blue house. Leni lives there. She works at a table by the window. Poma sleeps on a chair near her. Leni gives her water, but no food.

In the evening, Poma goes home. Vina puts a little food in her bowl. The three neighbours all know Poma. They like her visits. At night, she sleeps in Vina's kitchen.`,
    questions: [
      mc("What colour is Poma?", ["White", "Black", "Red", "Blue"], "The first sentence says Poma is a small white cat.", 0),
      blank("At night, Poma sleeps in Vina's ______.", "kitchen", "The last sentence places her in Vina's kitchen at night."),
      main(["A cat visits two neighbours and goes home.", "A cat looks for a new home.", "A cat eats at three houses.", "A cat stays in a kitchen all day."], "Poma visits Rem and Leni, then returns to Vina's house.", 1),
      tf("Leni gives Poma food.", "false", "The passage says Leni gives her water, but no food."),
      vocab("near", ["Close to", "Under", "On top of", "Far from"], "Poma sits near Rem's feet: she is close to his feet.", 2),
      mc("What does Rem have?", ["A book", "A bowl", "A ball", "A bag"], "Rem sits next door with a book when Poma visits.", 3),
    ],
  },
  {
    id: "seed-reading-26", title: "Lunch on the Green Plate", topic: "School meals", cefr: "A1", difficulty: "BEGINNER", estimatedMinutes: 4,
    summary: "A pupil chooses a new school lunch and tells the cook what she likes.",
    content: `At Tembi School, lunch starts at twelve. There are two meals today. The meal on the white plate is rice and chicken. The meal on the green plate is rice and eggs. Both meals come with carrots. Water is on a small table by the door.

Sumi takes a green plate. She likes eggs. She sits with her friend Daro. He has a white plate. They eat at a long table near the window. Sumi likes the eggs, but the carrots are cold.

After lunch, the cook asks Sumi about her meal. She says the eggs are good. She also tells him about the cold carrots. He thanks her. Sumi puts her plate on a shelf and goes to class.`,
    questions: [
      tf("Both meals come with carrots.", "true", "The first paragraph states that both meals come with carrots."),
      vocab("starts", ["Begins", "Ends", "Costs", "Changes"], "Lunch starts at twelve, which gives the time it begins.", 3),
      mc("Why does Sumi take a green plate?", ["She likes eggs.", "She wants chicken.", "She wants no carrots.", "She likes cold food."], "The passage says Sumi takes a green plate and likes eggs.", 2),
      main(["Sumi tries a school meal and talks to the cook.", "Sumi makes lunch for her class.", "Sumi eats lunch at home with Daro.", "Sumi asks for lunch to start later."], "Sumi chooses her meal, eats it and tells the cook about it.", 0),
      blank("Water is on a small ______ by the door.", "table", "The first paragraph puts the water on a small table by the door."),
      mc("Where does Sumi put her plate after lunch?", ["On a shelf", "By the window", "On the floor", "In her bag"], "The final sentence says she puts her plate on a shelf.", 1),
    ],
  },
  {
    id: "seed-reading-27", title: "The Umbrella with a Silver Star", topic: "Everyday mistakes", cefr: "A2", difficulty: "BEGINNER", estimatedMinutes: 5,
    summary: "Two drawing students exchange umbrellas after taking the wrong ones home.",
    content: `Last Friday, Nori took a black umbrella to her drawing class at Tulven Centre. It rained all afternoon, so she left it open in the entrance to dry. After class, she picked up a black umbrella beside the door and walked home. On the handle, she noticed a silver star. Her own umbrella had a red string, so she knew this one belonged to someone else.

Nori called the centre before it closed. The teacher checked the entrance and found another black umbrella with a red string. A student called Bemi was still there. He was looking for his umbrella, which had a silver star on the handle.

The teacher kept Nori's umbrella in the office. On Saturday morning, Nori returned to the centre with Bemi's umbrella. Bemi met her there, and they exchanged them. They laughed about the mistake. Before she left, Nori tied a second red string to her handle because she wanted to see it more easily next time.`,
    questions: [
      main(["Two students correct an umbrella mix-up.", "Two students buy matching umbrellas.", "A teacher loses two students' umbrellas.", "A student gives away her only umbrella."], "Nori takes Bemi's umbrella and they exchange umbrellas the next morning.", 2),
      mc("Why did Nori leave her umbrella open?", ["To dry it", "To save a seat", "To show the teacher", "To hide the handle"], "The opening paragraph says she left it open in the entrance to dry.", 1),
      vocab("noticed", ["Saw", "Broke", "Bought", "Removed"], "Nori saw the silver star on the handle and recognised the mistake.", 0),
      tf("Bemi had already left when the teacher checked the entrance.", "false", "The passage says Bemi was still there, looking for his umbrella."),
      mc("When did the students exchange their umbrellas?", ["Saturday morning", "Friday morning", "Friday afternoon before class", "Saturday evening"], "Nori returned on Saturday morning, and Bemi met her there.", 3),
      blank("Nori's umbrella had a red ______.", "string", "Her umbrella had a red string, unlike Bemi's silver star."),
    ],
  },
  {
    id: "seed-reading-28", title: "Grandmother's Missing Spoonful", topic: "Family cooking", cefr: "A2", difficulty: "BEGINNER", estimatedMinutes: 5,
    summary: "A family records a missing step after a soup tastes different from usual.",
    content: `On Sunday, Tavi wanted to make his grandmother's bean soup. His grandmother, Mera, was visiting her sister, so he used the recipe in her old notebook. He bought beans, onions and tomatoes from a shop near his home. Then he washed the vegetables and put a large pot on the cooker.

His cousin Ruli came to help. She read the steps while Tavi cooked. After an hour, they tasted the soup. It was not bad, but it did not taste like Mera's soup. They checked the notebook again. They used every ingredient on the list and followed all five steps.

That evening, Mera came home and tried a little soup. She smiled and took a small jar from the shelf. She added one spoonful of dried mint. The cousins tasted the soup again and knew the familiar taste. Mera explained that she always added mint, but never wrote it down. Ruli added the missing ingredient to the notebook. Next Sunday, they planned to cook the soup together, with Mera watching.`,
    questions: [
      blank("Mera added dried ______ to the soup.", "mint", "Mera adds one spoonful of dried mint from a small jar."),
      tf("The cousins skipped one of the five written steps.", "false", "The second paragraph says they followed all five steps."),
      main(["A family adds an unwritten ingredient to a recipe.", "A family throws away a soup recipe.", "Two cousins replace beans with tomatoes.", "A grandmother learns a new soup from her cousins."], "The cousins discover the missing mint and Ruli records it in the notebook.", 3),
      vocab("familiar", ["Known from before", "Too cold", "Very sweet", "Difficult to make"], "After the mint is added, they recognise the taste of Mera's usual soup.", 1),
      mc("Who read the steps while Tavi cooked?", ["Ruli", "Mera", "Mera's sister", "The shop worker"], "The second paragraph says Ruli read the steps while Tavi cooked.", 2),
      mc("Where was Mera when Tavi started cooking?", ["At her sister's home", "In the vegetable shop", "Beside the cooker", "In Ruli's garden"], "The opening says Mera was visiting her sister when Tavi used the notebook.", 0),
    ],
  },
  {
    id: "seed-reading-29", title: "Singing Before Feeling Ready", topic: "Learning and confidence", cefr: "B1", difficulty: "INTERMEDIATE", estimatedMinutes: 6,
    summary: "A beginner choir helps nervous singers join in through shared practice.",
    content: `For years, Revi has enjoyed singing while washing dishes, but she has never sung in front of strangers. When a beginner choir opened at Lethra Hall, she almost ignored the notice. It promised that no singing test was needed, yet she still worried that everyone else would be better than her.

At the first meeting, leader Deni asked the twelve members to speak a short line together before singing it. Revi liked this because she could learn the words without thinking about the tune. They then sang in two groups, with one group repeating the other's line. Nobody had to sing alone. By the end of the evening, Revi was joining in without hiding behind her song sheet.

The choir has now met for six weeks. Revi thinks the shared exercises have helped more than simply being told to feel confident. She can hear how her voice fits with other voices, and mistakes do not stop the whole song. Deni has offered a short concert next month, but taking part is optional. Revi has not decided whether to perform. She has, however, already invited a neighbour to the next practice, because she wants someone else to experience the same friendly start.`,
    questions: [
      vocab("optional", ["A matter of choice", "Already cancelled", "Required for everyone", "Only for leaders"], "Revi can decide whether to perform because taking part is optional.", 0),
      mc("Why did Revi like speaking the line first?", ["She could learn the words without thinking about the tune.", "She could practise a solo for the concert.", "She could choose the next song.", "She could avoid meeting the other singers."], "The second paragraph gives learning words separately from the tune as her reason.", 3),
      blank("At the first meeting there were twelve ______.", "members", "Deni asked the twelve members to speak a short line together."),
      main(["Shared practice helps a nervous beginner take part in a choir.", "A choir requires nervous singers to give solo concerts.", "A choir replaces singing with spoken performances.", "A beginner leaves a choir because of its singing test."], "Revi becomes more willing to join in through group exercises without a compulsory performance.", 2),
      mc("What has Revi decided to do?", ["Invite a neighbour to practice", "Perform alone next month", "Lead the next meeting", "Stop attending after six weeks"], "The final sentence says she has already invited a neighbour to the next practice.", 1),
      tf("Members had to sing alone at the first meeting.", "false", "The second paragraph explicitly says nobody had to sing alone."),
    ],
  },
  {
    id: "seed-reading-30", title: "When the Class Screen Froze", topic: "Online learning", cefr: "B1", difficulty: "INTERMEDIATE", estimatedMinutes: 6,
    summary: "An online drawing class develops a simple backup after a connection problem.",
    content: `The evening drawing course at Velpin Studio has used online lessons since the start of winter. Students like joining from home, especially those who live outside town. Last Tuesday, however, a connection problem showed how easily a live lesson could lose its direction.

Teacher Nemi was showing how to draw the shadow under a cup when her video froze. The students could still hear her, but they could not see her pencil moving. Some kept drawing from the last image. Others waited because they thought she had asked them to pause. Nemi did not realise this until a student described the problem aloud.

Instead of ending the class, she sent three photographs of her drawing at different stages. She numbered them and explained each one by voice. Students used the last twenty minutes to finish their pictures. Several said the photographs were useful because they could look back at an earlier stage without interrupting her.

Since then, Nemi has prepared a small set of stage photographs before every lesson. She still teaches live because students value asking questions immediately. In her view, the photographs support that conversation rather than replace it. She has also asked students to report a frozen screen straight away, so that different people do not spend half a lesson following different instructions.`,
    questions: [
      mc("What remained possible when the video froze?", ["Hearing the teacher", "Watching the pencil move", "Seeing new live images", "Reading numbered photographs already sent"], "Students could still hear Nemi, but she sent the photographs only after learning of the problem.", 2),
      main(["A drawing teacher adds a backup while keeping live lessons.", "A drawing teacher replaces live lessons with silent pictures.", "Students abandon an online course after a frozen screen.", "Students learn that questions should wait until after class."], "Nemi prepares stage photographs but keeps live teaching for immediate questions.", 1),
      tf("All students responded to the frozen video in the same way.", "false", "Some kept drawing, while others waited because they thought they should pause."),
      blank("Nemi sent three ______ of her drawing.", "photographs", "The third paragraph says she sent three photographs showing different stages."),
      mc("Why did some students find the photographs useful?", ["They could revisit an earlier stage.", "They no longer needed any explanation.", "They showed drawings from a different course.", "They removed the need to finish a picture."], "Students could look back at an earlier stage without interrupting Nemi.", 0),
      vocab("immediately", ["Without waiting", "In private", "Only once", "Very quietly"], "Live teaching lets students ask questions immediately, without waiting for another session.", 3),
    ],
  },
  {
    id: "seed-reading-31", title: "Finding the Pool on a Town Website", topic: "Digital access", cefr: "B2", difficulty: "ADVANCED", estimatedMinutes: 7,
    summary: "A town tests its redesigned website by asking residents to complete everyday tasks.",
    content: `When the town of Orvelin redesigned its website, the first presentation concentrated on appearance. Large photographs replaced crowded lists, and each department received a distinctive colour. Staff praised the result as modern and welcoming. Yet a resident trying to find Saturday swimming times had to know that the pool belonged under Community Assets, a heading that meant little to visitors.

The design team consequently invited residents to complete six ordinary tasks on both the old and new sites. Participants were not asked which design they preferred until afterwards. Instead, observers recorded whether they found the correct information and where they hesitated. This distinction mattered: several people admired the photographs but repeatedly selected the wrong heading.

In response, the team organised the main page around activities, including swimming, reporting a broken street light and booking a room. Department names remained on internal pages, where staff still needed them. The photographs were reduced in size rather than removed, preserving some of the welcome that participants had valued.

The second test produced fewer wrong turns, although two participants using small phone screens still missed the search box. The team therefore delayed the launch to improve its position. Some staff considered this excessive attention to a minor feature. The project leader argued that a polished opening page was of limited value if people could not accomplish the task that brought them there. The redesign would be judged by successful use, with visual appeal contributing to that goal rather than serving as its substitute.`,
    questions: [
      main(["Website design improves when everyday tasks guide its organisation.", "A town website succeeds by showing the largest possible photographs.", "A town website can remove all departmental information.", "Residents should learn staff terminology before using a website."], "Task tests reveal navigation problems, leading the team to prioritise successful use.", 0),
      blank("The pool originally appeared under Community ______.", "Assets", "The first paragraph names the original heading as Community Assets."),
      vocab("hesitated", ["Paused because they were unsure", "Expressed approval loudly", "Closed their accounts", "Finished without difficulty"], "Observers recorded uncertainty as participants tried to locate information.", 2),
      mc("Why were preference questions asked after the tasks?", ["To observe task performance before collecting design opinions", "To prevent residents from seeing the photographs", "To let staff answer all six tasks first", "To avoid recording navigation errors"], "The test separates finding information and hesitation from later opinions about appearance.", 3),
      tf("All photographs were removed after the first test.", "false", "The third paragraph says photographs were reduced in size rather than removed."),
      mc("What caused the launch to be delayed?", ["The search box was missed on small phone screens.", "Every participant preferred the old colours.", "The swimming pool had closed.", "Staff wanted to remove the activity headings."], "Two phone users missed the search box, so the team delayed launch to improve its position.", 1),
    ],
  },
  {
    id: "seed-reading-32", title: "Homework Measured in Questions", topic: "Education and evidence", cefr: "B2", difficulty: "ADVANCED", estimatedMinutes: 7,
    summary: "A school trials shorter homework that reveals where pupils need help.",
    content: `At Dovren School, a debate about homework initially divided teachers into two camps. One group regarded long assignments as evidence of serious study, while another wanted all homework abolished. A mathematics teacher, Seli, suggested that both positions overlooked a more useful question: what information did the completed work provide?

For one term, two classes received three carefully chosen problems each evening instead of a full page. After each answer, pupils wrote one sentence explaining a decision they had made. Teachers used these comments to identify misunderstandings before the next lesson. A correct answer accompanied by confused reasoning could therefore be more informative than an obvious calculation error.

Pupils generally reported spending less time on homework, but the results were not uniformly positive. Some rushed their explanations because they considered the numbers the only important part. Teachers responded by discussing anonymous examples in class, showing how a brief explanation could reveal a useful question. They did not increase the number of problems.

At the end of term, test scores were similar to those of the previous term. Seli resisted describing this as proof that shorter assignments always worked better. The topics had changed, and pupils had received additional feedback during the trial. Those differences made a direct comparison uncertain. Nevertheless, teachers reported that they could plan the following lesson more precisely. The school extended the trial to another term, retaining the explanation sentence and collecting examples of how it influenced teaching. Its immediate purpose was to improve the connection between homework and classroom decisions, rather than settle every argument about how many minutes pupils should study at home.`,
    questions: [
      tf("Teachers increased the number of problems when explanations were rushed.", "false", "The third paragraph explicitly says they did not increase the number of problems."),
      main(["A school tests homework designed to inform the next lesson.", "A school proves shorter homework always raises scores.", "A school ends homework after a disagreement among teachers.", "A school replaces explanations with longer pages of calculations."], "The trial uses reasoning sentences to identify misunderstandings and guide classroom decisions.", 3),
      mc("What did pupils write after each answer?", ["A sentence explaining a decision", "A score for the teacher", "A second version of every problem", "A list of the previous term's topics"], "The second paragraph requires one sentence explaining a decision they had made.", 0),
      vocab("uniformly", ["In every case", "For a short period", "Without being checked", "By chance"], "The results were not uniformly positive because some pupils rushed their explanations.", 1),
      blank("Teachers discussed ______ examples in class.", "anonymous", "The third paragraph says they discussed anonymous examples to show the value of explanations."),
      mc("Why was Seli cautious about comparing test scores?", ["Topics and feedback differed between terms.", "No pupils completed the tests.", "The new assignments contained no mathematics.", "Teachers had lost the previous scores."], "Changed topics and additional feedback made a direct comparison uncertain.", 2),
    ],
  },
  {
    id: "seed-reading-33", title: "The Pause That Cannot Be Scheduled", topic: "Attention and creativity", cefr: "C1", difficulty: "ADVANCED", estimatedMinutes: 8,
    summary: "A design studio questions whether formally scheduled empty time can preserve the benefits of unplanned pauses.",
    content: `At the Elvaren design studio, an unusually productive conversation began while three colleagues were waiting for a delayed delivery. With no meeting agenda to follow, they returned to a packaging problem that formal discussions had repeatedly left unresolved. Their eventual proposal was modest, but it connected concerns that had previously been treated separately. The director subsequently announced a weekly hour of empty time, hoping to reproduce the conditions of that exchange.

The intention was sympathetic; its implementation was less straightforward. Staff were asked to record any useful ideas arising during the hour. Several began preparing topics in advance, anxious to demonstrate that they had used the opportunity responsibly. What had been presented as freedom from immediate demands acquired a reporting requirement and, with it, a reason to remain visibly purposeful.

This does not establish that deliberate pauses are worthless. A protected interval may prevent routine tasks from consuming every available moment. It does, however, expose a tension between making space for an outcome and requiring that outcome to appear. The original conversation was possible partly because the colleagues were temporarily released from the expectation of producing anything particular. Its value became apparent afterwards, rather than serving as an instruction beforehand.

The studio eventually retained the free hour but dropped the idea log. Participation in informal conversation remained voluntary, and staff could spend the interval alone. The director acknowledged that this arrangement would be harder to justify through a monthly count of proposals. That concession was central to the change: if every pause had to supply evidence of productivity, the studio would preserve the timetable of empty time while quietly removing the quality that had made it promising.`,
    questions: [
      vocab("concession", ["An acceptance of a limitation", "A compulsory written proposal", "A delay to a delivery", "An additional meeting agenda"], "The director accepts that the arrangement is harder to justify by counting proposals.", 1),
      tf("The studio required staff to join group conversations during the retained hour.", "false", "The final paragraph says conversation remained voluntary and staff could spend the time alone."),
      blank("The studio eventually dropped the idea ______.", "log", "The final paragraph states that it retained the free hour but dropped the idea log."),
      mc("Why did some staff prepare topics in advance?", ["They wanted to show responsible use of the hour.", "A delayed delivery required a written complaint.", "The director had banned spontaneous conversation.", "The original packaging proposal had been rejected."], "Staff were anxious to demonstrate responsible use after being asked to record useful ideas.", 2),
      main(["Protecting unstructured time may require accepting uncertain outcomes.", "Unstructured time is useful only when each hour yields a proposal.", "A studio should replace every formal meeting with solitary work.", "A studio proves that all planned pauses prevent useful conversation."], "The argument supports protected time while questioning demands for measurable output from each pause.", 0),
      mc("What distinguishes the original conversation from the reporting arrangement?", ["Its value was recognised afterwards rather than required beforehand.", "It followed a detailed agenda set by the director.", "It involved every member of the studio.", "It produced a monthly count of proposals."], "The third paragraph contrasts value apparent afterwards with an instruction beforehand.", 3),
    ],
  },
];
