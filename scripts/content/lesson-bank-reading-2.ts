import type { ReadingBankLesson, ReadingItem, ReadingKind } from "./lesson-bank-data";

// Each choice is supplied with its answer first, then rotated for varied positions.
function choice(type: ReadingKind, prompt: string, options: string[], explanation: string, position: number): ReadingItem {
  const answer = options[0];
  const rotated = [...options];
  rotated.splice(0, 1);
  rotated.splice(position, 0, answer);
  return { type, prompt, options: rotated, answer, explanation };
}
const mc = (prompt: string, options: string[], explanation: string, p: number) => choice("MULTIPLE_CHOICE", prompt, options, explanation, p);
const main = (options: string[], explanation: string, p: number) => choice("MAIN_IDEA", "Which sentence best summarises the passage?", options, explanation, p);
const vocab = (word: string, options: string[], explanation: string, p: number) => choice("VOCAB_IN_CONTEXT", `In the passage, "${word}" means:`, options, explanation, p);
const tf = (prompt: string, answer: "true" | "false", explanation: string): ReadingItem => ({ type: "TRUE_FALSE", prompt, answer, explanation });
const blank = (prompt: string, answer: string, explanation: string): ReadingItem => ({ type: "FILL_BLANK", prompt, answer, explanation });

export const readingLessons2: ReadingBankLesson[] = [
  {
    id: "seed-reading-13", title: "Bread Before Sunrise", topic: "Daily routines", difficulty: "BEGINNER", estimatedMinutes: 5,
    summary: "A baker changes her morning routine to serve people who start work early.",
    content: `Nemi has a small bakery in Pebblerow. Her shop opened at eight every morning, but the cleaners from the bus station started work at six. They often walked past the dark shop and bought breakfast somewhere else. One cleaner asked Nemi if she could sell bread earlier.

Nemi decided to try a new opening time for one week. She arrived at four and opened the shop at half past five. She made small rolls first because they cooked quickly. Cakes came later in the morning. Her brother helped put the warm rolls into paper bags. They placed a yellow board outside with the new hours.

On Monday, only three people came before six. By Friday, there were twelve early customers. Nemi was tired, but she was pleased to see them. She decided to keep the early opening from Monday to Friday. On Saturdays, the bakery still opened at eight. She also started going home an hour earlier each afternoon, so she had time to rest before the next morning.`,
    questions: [
      main(["A bakery changes its hours for early workers.", "A bakery stops selling rolls to make only cakes.", "A bakery moves into a bus station.", "A bakery opens earlier only on Saturdays."], "Nemi tests an earlier opening and keeps it on weekdays for early customers.", 0),
      mc("Why did Nemi make small rolls first?", ["They cooked quickly.", "The cakes were too expensive.", "Her brother disliked cakes.", "The cleaners asked for large loaves."], "The passage says she made small rolls first because they cooked quickly.", 1),
      blank("The board outside the bakery was ______.", "yellow", "They placed a yellow board outside showing the new hours."),
      vocab("pleased", ["Happy", "Hungry", "Late", "Cold"], "Nemi was pleased to see the customers, showing she was happy they came.", 2),
      tf("The bakery opened at half past five on Saturdays after the trial.", "false", "The passage says the bakery still opened at eight on Saturdays."),
      mc("How did Nemi make time to rest?", ["She went home earlier in the afternoon.", "She closed every Friday.", "She stopped making cakes.", "She arrived at eight each day."], "The final sentence says she started going home an hour earlier each afternoon.", 3),
    ],
  },
  {
    id: "seed-reading-14", title: "Voices at Lunchtime", topic: "School activities", difficulty: "BEGINNER", estimatedMinutes: 5,
    summary: "A school radio club learns to prepare a short lunchtime programme.",
    content: `At Brackenpin School, Ludo and his friends started a radio club. Their first programme was on Tuesday at lunchtime. Students could listen through the speakers in the dining room. The club had ten minutes, so the friends could not include everything they wanted.

Ludo wanted to play three songs. His friend Miri wanted to read the school news. Their teacher asked them to make a plan before they used the microphone. They chose one song, two news stories and a short interview with the school cook. The cook talked about a new vegetable soup. She did not give a cooking lesson.

On Monday, the club practised in an empty classroom. Miri spoke too fast at first. Ludo held up a card with the word SLOW on it, and she tried again. This time everyone understood her. During Tuesday's programme, the song stopped for a few seconds, but the news and interview went well. After lunch, several students asked about joining the club. The friends wrote down their ideas for the next programme in a notebook.`,
    questions: [
      tf("The cook gave a cooking lesson during the interview.", "false", "The cook talked about a new soup; the passage says she did not give a cooking lesson."),
      vocab("practised", ["Tried something to get better at it", "Sold tickets for something", "Forgot about something", "Finished eating something"], "They tried the programme in an empty classroom before broadcasting it on Tuesday.", 3),
      main(["A radio club prepares and presents its first short programme.", "A radio club replaces all news with three songs.", "A radio club teaches students to cook soup.", "A radio club cancels its first broadcast."], "The story follows planning, practice and the first lunchtime programme.", 2),
      blank("The club kept ideas for the next programme in a ______.", "notebook", "The final sentence says they wrote their ideas in a notebook."),
      mc("How long was the club's programme?", ["Ten minutes", "Two minutes", "Thirty minutes", "An hour"], "The first paragraph states that the club had ten minutes.", 1),
      mc("Why did Ludo hold up the SLOW card?", ["Miri was speaking too fast.", "The song was too quiet.", "The cook was late.", "Students were eating too quickly."], "Miri spoke too fast, so Ludo held up the card and she tried again.", 0),
    ],
  },
  {
    id: "seed-reading-15", title: "A Different Stop for Tesa", topic: "Travel routines", difficulty: "BEGINNER", estimatedMinutes: 5,
    summary: "Tesa follows a temporary bus notice to reach her sewing class.",
    content: `Tesa takes the number nine bus to her sewing class every Thursday. She usually waits outside the flower shop in Rillpocket. Last Thursday, she saw a notice on the bus stop. Workers were fixing the road, so buses could not stop there for three days. The notice showed a map of a temporary stop beside the sports hall.

Tesa did not know that part of town well. She looked at the map and followed the blue arrows along the pavement. The walk took seven minutes. At the sports hall, a driver was waiting beside his bus. He told her that the bus still went to the same places after leaving this stop.

Tesa arrived at class five minutes early. She told her teacher about the change, and they put a note on the classroom door for the other students. After class, Tesa checked the notice again. The flower shop stop would open on Sunday. She kept a photo of the map on her phone in case she needed the bus before then. She was glad she had left home with extra time that morning.`,
    questions: [
      blank("The temporary stop was beside the ______.", "sports hall", "The notice showed a temporary stop beside the sports hall."),
      mc("Why was the usual stop closed?", ["Workers were fixing the road.", "The flower shop was moving.", "The bus driver was on holiday.", "The sewing class had ended."], "The first paragraph directly links the closure to workers fixing the road.", 2),
      tf("The bus still went to the same places after leaving the temporary stop.", "true", "The driver told Tesa the bus still went to the same places after this stop."),
      main(["Tesa uses a notice and map to manage a temporary bus change.", "Tesa gives up her sewing class after a bus change.", "Tesa asks for a permanent new bus route.", "Tesa takes a bus to buy flowers instead of going to class."], "Tesa reads the notice, finds the temporary stop and arrives early for class.", 1),
      vocab("temporary", ["Lasting for a short time", "Very far away", "Open only at night", "Difficult to see"], "The stop replaces the usual one for three days, so it lasts for a short time.", 0),
    ],
  },
  {
    id: "seed-reading-16", title: "Saturday at the Stitch Table", topic: "Learning a skill", difficulty: "BEGINNER", estimatedMinutes: 5,
    summary: "A teenager learns to mend a shirt at a neighbourhood repair session.",
    content: `Vemi had a blue shirt with a missing button. She wanted to wear it to her cousin's picnic, but she did not know how to fix it. On Saturday, she took the shirt to a repair table at the hall in Mossrill. People met there once a month to help each other mend clothes.

A helper named Orin showed Vemi a box of buttons. She found a blue one that was the right size. Orin gave her a needle and some thread. He showed her the first few stitches on a piece of old cloth. Then Vemi worked on her own shirt while he watched. She went slowly and checked the button twice.

There was no charge for the help. A small box on the table was for spare buttons, not money. Before leaving, Vemi put two green buttons from home into the box. They were too small for her shirt, but another visitor could use them. At the picnic on Sunday, her cousin liked the shirt. Vemi was proud because she had repaired it herself, and she planned to return with a torn bag next month.`,
    questions: [
      vocab("spare", ["Extra and available to use", "Broken beyond repair", "Only for sale", "Already sewn onto shirts"], "Visitors leave extra buttons in the box so someone else can use them.", 1),
      main(["Vemi learns to repair a shirt with help from a shared repair table.", "Vemi buys a new shirt at a monthly clothes sale.", "Vemi teaches Orin to sew before a picnic.", "Vemi pays for a helper to make a whole shirt."], "Orin demonstrates stitches and Vemi repairs her own shirt without a charge.", 3),
      tf("The box on the table was for collecting money.", "false", "The passage explicitly says the box was for spare buttons, not money."),
      mc("What did Orin use to demonstrate the stitches?", ["A piece of old cloth", "Vemi's torn bag", "His own blue shirt", "A green button box"], "Orin showed the first few stitches on a piece of old cloth.", 0),
      blank("Vemi planned to bring a torn ______ next month.", "bag", "The closing sentence says she planned to return with a torn bag."),
    ],
  },
  {
    id: "seed-reading-17", title: "Two Languages over Tea", topic: "Language learning", difficulty: "INTERMEDIATE", estimatedMinutes: 6,
    summary: "A language exchange changes its format so both partners get equal practice.",
    content: `When a language exchange began at the Ambernest community room, the organisers expected conversation to flow naturally. Each pair included one person learning English and another learning Vietnamese. They met on Wednesday evenings, brought their own tea and chose topics from cards on the tables.

After three meetings, several members reported a problem. Whenever someone struggled to find a word, the pair switched to the stronger speaker's preferred language. As a result, one partner often received much more practice than the other. Nobody intended to be unfair, but friendly conversation alone was not producing balanced learning.

The organiser, Sori, introduced a simple timer. Partners now spent fifteen minutes speaking one language, followed by fifteen in the other. They saved detailed corrections for the final five minutes rather than interrupting every sentence. Beginners could use picture cards if the topic cards felt too difficult.

Members said the new structure helped them relax because they knew their turn would come. A few still preferred free conversation, so the room remained open afterwards for an informal chat. Sori kept this optional period separate from the exchange itself. Her aim was to make equal practice dependable while leaving space for friendship.`,
    questions: [
      mc("Why did some members receive less practice initially?", ["Pairs switched to the stronger speaker's preferred language.", "The meetings were held only once a year.", "Topic cards were available in only one room.", "The organiser prevented beginners from speaking."], "Pairs switched languages when someone struggled, giving one partner more practice.", 3),
      main(["A language exchange adds structure to make practice more balanced.", "A language exchange abandons all informal conversation.", "A language exchange replaces partners with written tests.", "A language exchange gives advanced speakers all the practice time."], "The timer and correction period address unequal practice while optional chatting remains.", 0),
      vocab("dependable", ["Reliable", "Expensive", "Surprising", "Brief"], "Knowing their turn would come made equal practice reliable for members.", 2),
      blank("Partners used a ______ to divide their speaking time.", "timer", "Sori introduced a simple timer for fifteen minutes in each language."),
      tf("Detailed corrections were saved for the final five minutes.", "true", "The third paragraph says they saved detailed corrections for the final five minutes."),
      mc("What could beginners use instead of topic cards?", ["Picture cards", "Recorded examinations", "A list of attendance rules", "Newspaper reports"], "The passage offers picture cards when the topic cards feel too difficult.", 1),
    ],
  },
  {
    id: "seed-reading-18", title: "The Orchestra's Listening Seats", topic: "Music", difficulty: "INTERMEDIATE", estimatedMinutes: 6,
    summary: "A youth orchestra invites newcomers to observe a rehearsal before deciding whether to join.",
    content: `The youth orchestra in Fernspindle had room for more players, yet few students answered its posters. Conductor Davi asked music teachers why. Several students thought they needed to play perfectly before joining. Others did not know what happened at a rehearsal and worried about making mistakes in front of a large group.

Instead of arranging another formal performance, Davi introduced listening seats. On the first Saturday of each month, visitors could sit beside the orchestra during an ordinary rehearsal. They did not need to bring an instrument or promise to join. Players explained their music during the break, and visitors could ask questions.

At the first session, a difficult section of a piece stopped the group several times. Davi worried that visitors would be disappointed. However, one student said watching the players try again made the orchestra seem less frightening. She had assumed that experienced musicians never needed to repeat anything.

Three visitors later requested a short playing meeting with Davi. This was still necessary before joining, since he needed to find a suitable part for each player. The listening seats did not remove that step. They simply gave students a clearer picture of the group before making a decision.`,
    questions: [
      main(["Observing rehearsal helps students make an informed decision about joining an orchestra.", "Public concerts replace rehearsals in a youth orchestra.", "An orchestra admits visitors without hearing them play.", "A conductor stops newcomers from observing mistakes."], "Listening seats show ordinary rehearsal, but a playing meeting is still required to join.", 1),
      tf("Visitors had to promise to join before using the listening seats.", "false", "The second paragraph says visitors did not need to promise to join."),
      mc("Why was a playing meeting still needed?", ["To find a suitable part for each player", "To sell tickets for the next concert", "To choose the colour of the posters", "To stop visitors from asking questions"], "Davi needed to hear each player to find a suitable part.", 2),
      vocab("ordinary", ["Usual", "Silent", "Private", "Perfect"], "Visitors watch a regular rehearsal rather than a specially arranged formal performance.", 0),
      blank("Players explained their music during the ______.", "break", "The second paragraph states that players explained their music during the break."),
      mc("What reassured one visitor?", ["Seeing players repeat a difficult section", "Hearing that rehearsals never stopped", "Receiving a free instrument", "Learning that no playing meeting was needed"], "Watching the players try again made the orchestra seem less frightening to her.", 3),
    ],
  },
  {
    id: "seed-reading-19", title: "The Apprentice's Practice Shelf", topic: "Work and learning", difficulty: "INTERMEDIATE", estimatedMinutes: 6,
    summary: "A woodworking apprentice gains responsibility through a carefully planned first project.",
    content: `During her first month at a woodworking workshop in Hazelquay, Peli mostly swept floors and sorted pieces of wood. These jobs helped her learn where things belonged, but she wanted to understand how furniture was made. Her supervisor, Bren, agreed that watching alone was not enough.

He gave her a small project: a shelf for the workshop's instruction books. The shelf would stay inside the workshop rather than go to a customer. Peli first drew a plan and measured the available wall space. Bren checked those measurements before she began cutting. He also demonstrated each tool before she used it under his supervision.

Her first pair of side pieces had different lengths. There was enough spare wood to replace one, but Bren asked her to identify the cause before cutting again. Peli discovered that she had read the wrong mark on her ruler. She added a measurement check to her written plan.

The finished shelf was not perfectly smooth, yet it held the books securely. Bren discussed what could improve and gave her a more demanding practice task for the following week. Peli still helped clean the workshop, but now those routine duties were combined with planned opportunities to develop her skills.`,
    questions: [
      tf("Peli's first shelf was intended for a customer.", "false", "The shelf would stay inside the workshop rather than go to a customer."),
      blank("Peli had read the wrong mark on her ______.", "ruler", "She discovered that the unequal lengths came from reading the wrong ruler mark."),
      vocab("securely", ["Firmly and safely", "For a short time only", "Without being seen", "With no books on it"], "Although not perfectly smooth, the finished shelf held the books firmly.", 3),
      main(["A supervised project helps an apprentice learn from an early mistake.", "An apprentice stops cleaning because practice tasks are unnecessary.", "An apprentice sells her first shelf before it is checked.", "A workshop replaces practical training with observation alone."], "Bren plans a project, checks her work and helps her investigate the measurement mistake.", 2),
      mc("What did Bren ask Peli to do before cutting a replacement?", ["Identify the cause of the unequal lengths", "Sell the spare wood", "Move the workshop's books outside", "Use the two unequal pieces without changes"], "Bren asked her to identify the cause before cutting again.", 0),
    ],
  },
  {
    id: "seed-reading-20", title: "Where the Clifftop Path Ends", topic: "Outdoor access", difficulty: "INTERMEDIATE", estimatedMinutes: 6,
    summary: "A walking group improves its directions after visitors misunderstand a coastal path closure.",
    content: `After heavy rain damaged part of the coastal path near Driftbell, the walking group put a closure notice at its eastern entrance. The damaged section was short, but walkers could not pass it safely. A longer inland route remained open and reached the same beach.

The group initially thought that a clear warning would be enough. However, visitors arriving from the western car park walked almost two kilometres before finding a barrier. Some then returned to their cars, disappointed that they had not heard about the closure earlier. The notice at the eastern entrance had never been on their route.

Volunteer coordinator Evi walked both approaches and spoke to several visitors. She then placed information at the western car park as well. The new signs included the extra distance and approximate walking time of the inland route. They also explained that the alternative crossed a steep field, so visitors could judge whether it suited them.

During the following weekend, fewer people reached the barrier without knowing about it. The path was still closed, and the inland walk was still longer. Nevertheless, visitors could make their choice before starting. For Evi, useful directions meant reaching people at the point where they needed to decide, rather than simply displaying a correct warning somewhere nearby.`,
    questions: [
      mc("Why did western visitors miss the original notice?", ["It was at an entrance they did not use.", "They had all arrived after dark.", "The group had removed it before the rain.", "It was hidden behind the western barrier."], "The eastern notice had never been on the western visitors' route.", 1),
      vocab("approximate", ["Estimated rather than exact", "Guaranteed to be shorter", "Recorded after every walk", "Impossible to understand"], "The signs give a walking time to help visitors plan, rather than an exact time for every person.", 2),
      blank("The alternative route crossed a steep ______.", "field", "The new information explained that the alternative crossed a steep field."),
      tf("The new signs reopened the damaged coastal section.", "false", "The final paragraph explicitly says the path was still closed."),
      main(["Path information becomes more useful when walkers receive it before choosing a route.", "The coastal path becomes shorter after storm damage.", "The walking group removes all warnings about the path.", "Every coastal visitor prefers a steep inland route."], "Signs at both approaches let visitors choose before walking to the barrier.", 3),
    ],
  },
  {
    id: "seed-reading-21", title: "Counting Birds beyond the Easy Corners", topic: "Citizen science", difficulty: "ADVANCED", estimatedMinutes: 7,
    summary: "A bird survey adjusts its coverage after volunteers concentrate on convenient locations.",
    content: `A volunteer bird survey in Thistledene produced an impressive number of records during its first spring. Organisers initially celebrated the growing total, but a map revealed that most observations came from paths beside the visitor centre. The marsh on the opposite side of the reserve had received little attention, despite containing a different range of habitats.

This imbalance did not mean that volunteers had recorded birds incorrectly. Rather, it made the combined list a poor basis for describing the whole reserve. Birds associated with accessible paths appeared frequently, while those favouring the marsh might have been overlooked. A larger total of observations could therefore coexist with substantial gaps in coverage.

For the next survey, organisers divided the reserve into sections and offered guided visits to the less familiar areas. Volunteers recorded the length of each visit as well as the species seen. They could decline a section if its terrain was unsuitable for them; remaining gaps would be shown in the report rather than silently treated as places without birds.

The revised approach required more coordination and generated fewer records in its opening week. Nevertheless, the organisers considered the information more useful because its geographical limits were clearer. They argued that participation and reliable evidence could support each other, provided that collecting large numbers was not mistaken for achieving representative coverage.`,
    questions: [
      blank("The poorly covered habitat was the ______.", "marsh", "The first paragraph identifies the marsh as receiving little attention."),
      main(["A bird survey needs clear coverage as well as many records.", "A bird survey proves that marshes contain no birds.", "Volunteer bird observations must always be discarded.", "Bird counts should focus exclusively on convenient paths."], "The map exposes gaps, and revised methods make the survey's geographical limits clearer.", 2),
      mc("What did volunteers record alongside the species seen?", ["The length of each visit", "The age of every bird", "The price of entry to the reserve", "The distance from each bird to the visitor centre"], "The third paragraph says volunteers recorded the length of each visit as well as the species seen.", 3),
      tf("Volunteers could decline a section if the terrain was unsuitable for them.", "true", "The revised plan explicitly allowed volunteers to decline unsuitable terrain."),
      vocab("coexist", ["Be present at the same time", "Cancel each other completely", "Develop in separate years", "Be measured without a map"], "Many records and substantial coverage gaps could both be present in the same survey.", 0),
      mc("How would unvisited areas appear in the report?", ["As gaps in coverage", "As areas proven to contain no birds", "As areas with the highest bird numbers", "As observations made at the visitor centre"], "Remaining gaps would be shown rather than treated as places without birds.", 1),
    ],
  },
  {
    id: "seed-reading-22", title: "Whose Words Enter the Archive?", topic: "Local history", difficulty: "ADVANCED", estimatedMinutes: 7,
    summary: "A town archive makes the limits of its historical letters visible to readers.",
    content: `When the town archive in Wrenhollow put a collection of old letters online, the project attracted readers who had never visited its reading room. The letters described workshop disputes, neighbourhood celebrations and changes to the riverside. Searchable copies made these accounts easier to explore, but the archivists resisted presenting them as a complete portrait of town life.

Most letters had come from three families whose papers were carefully stored and later donated. Residents who moved frequently, or whose papers were discarded, appeared much less often. The survival of a document reflected decisions about keeping it, not merely the importance of the experience it described. Digitising the collection widened access without correcting this inherited imbalance.

The archive therefore added a short note explaining how the papers had arrived. It also invited residents to contribute recorded memories, with permission required before any recording became public. These accounts would supplement the letters, rather than provide a final, fully balanced version of the past.

Some readers wanted the explanatory note removed because it interrupted their browsing. The archivists kept it, arguing that knowing where evidence comes from changes how it can be interpreted. Their aim was neither to discredit the letters nor to make every account equally typical. It was to help readers distinguish an accessible collection from an exhaustive history.`,
    questions: [
      vocab("exhaustive", ["Covering everything relevant", "Difficult to read aloud", "Arranged by family name", "Recently made public"], "The closing contrast distinguishes an accessible collection from a history covering everything.", 2),
      tf("Making the letters digital corrected the collection's inherited imbalance.", "false", "The second paragraph explicitly says digitising widened access without correcting the imbalance."),
      main(["An archive can widen access while explaining the limits of its surviving evidence.", "An online archive guarantees a complete account of every resident.", "Historical letters become useless once recorded memories are collected.", "An archive should hide how its papers were obtained."], "The archive provides online letters, explains their origins and acknowledges missing perspectives.", 1),
      mc("What was required before a recorded memory became public?", ["Permission", "A donation from three families", "Removal of the explanatory note", "Proof that it described the riverside"], "The third paragraph requires permission before any recording becomes public.", 0),
      blank("Most letters came from three ______.", "families", "The second paragraph says most letters came from three families who kept their papers."),
      mc("Why did archivists retain the explanatory note?", ["The origin of evidence affects its interpretation.", "It made the letters impossible to search.", "It proved all families had identical experiences.", "It replaced the need to preserve original letters."], "They argued that knowing where evidence comes from changes how it can be interpreted.", 3),
    ],
  },
  {
    id: "seed-reading-23", title: "The Borrowed Drill's Journey", topic: "Shared resources", difficulty: "ADVANCED", estimatedMinutes: 7,
    summary: "A tool library discovers that reliable borrowing depends on maintenance as well as membership.",
    content: `The tool library in Alderquill was established to let residents borrow equipment they needed only occasionally. Its early publicity emphasised the number of registered members and suggested that sharing could reduce unnecessary purchases. Yet after six months, coordinator Reni found that membership alone revealed little about whether the service actually worked.

The most requested drill was frequently unavailable, even when nobody had borrowed it. Returned equipment waited on a shelf until a volunteer could inspect it. Because inspection sessions took place only once a fortnight, a tool returned just after a session might remain unavailable for nearly two weeks. Buying another drill would not necessarily remove this delay.

Reni rearranged the volunteer timetable to provide shorter inspection sessions twice a week. She also separated tools awaiting inspection from those ready to lend, making the booking list more accurate. Volunteers continued to refer damaged equipment to a trained repairer rather than attempting repairs beyond their skills.

Over the next month, the average wait for a drill fell, although demand remained uneven. The library began reporting completed loans and time spent awaiting inspection alongside membership totals. These measures did not establish how many purchases had been avoided. They did, however, describe the practical availability of shared equipment more honestly and identify a part of the service that organisers could improve.`,
    questions: [
      mc("Why could the drill be unavailable when nobody had borrowed it?", ["It was waiting for inspection.", "It had been permanently given away.", "Only registered repairers could borrow it.", "The library never owned a drill."], "Returned tools waited on a shelf until a volunteer inspection session.", 2),
      blank("Originally, inspection sessions took place once a ______.", "fortnight", "The passage specifies inspection sessions only once a fortnight."),
      main(["A tool library improves availability by examining its inspection process.", "A tool library proves every loan prevents a new purchase.", "A tool library replaces all trained repairers with borrowers.", "A tool library finds membership totals fully explain its performance."], "Reni traces delays to inspection, changes the timetable and reports practical service measures.", 0),
      vocab("occasionally", ["From time to time", "Without permission", "Every hour", "In perfect condition"], "The equipment is borrowed for needs that arise from time to time, rather than constantly.", 3),
      tf("The new measures established how many purchases had been avoided.", "false", "The final paragraph explicitly says these measures did not establish avoided purchases."),
    ],
  },
  {
    id: "seed-reading-24", title: "A Quieter Journey, a Clearer Rule", topic: "Public transport", difficulty: "ADVANCED", estimatedMinutes: 7,
    summary: "A railway trial improves communication about a quiet carriage without claiming that every conflict is solved.",
    content: `On trains serving Cinderbay, a trial quiet carriage was intended to offer passengers a calmer journey. Small symbols above the windows asked people to avoid phone calls and use headphones at a low volume. However, complaints during the first month concerned confusion as much as deliberate disregard for the rule.

Some passengers boarded through a crowded doorway and did not notice the symbols until they had settled into their seats. Others assumed that quiet meant no conversation at all, although brief, soft exchanges were allowed. Staff reported spending more time explaining the rule than dealing with persistent noise.

The operator responded by placing plain wording beside the carriage doors and adding an announcement before the busiest station. The rule itself remained unchanged. Passengers who needed to make a call were asked to move to the space between carriages. Staff could still intervene when someone repeatedly ignored requests to lower the noise.

A later survey found that more passengers understood the arrangement. It did not show that everyone preferred it: families travelling together sometimes favoured the ordinary carriages, and some passengers wanted stricter silence. The trial team therefore distinguished clearer understanding from universal approval. A rule can become easier to follow without resolving every difference in how people wish to use a shared space.`,
    questions: [
      tf("Brief, soft conversations were allowed in the quiet carriage.", "true", "The second paragraph explicitly allows brief, soft exchanges."),
      main(["Clearer communication helps passengers understand a quiet carriage rule despite differing preferences.", "Quiet carriage passengers all want exactly the same level of silence.", "A railway abandons its quiet carriage after changing the rule.", "A quiet carriage survey proves that signs eliminate every noise problem."], "New wording improves understanding, while the survey still finds differing preferences.", 3),
      blank("Passengers needing to make a call were asked to use the space between ______.", "carriages", "The third paragraph directs callers to the space between carriages."),
      mc("What changed after the first month?", ["The wording and placement of information", "The permission for brief soft exchanges", "The requirement to keep headphone volume low", "The ability of staff to intervene"], "The operator added door wording and an announcement while keeping the rule unchanged.", 1),
      vocab("intervene", ["Step in to deal with a situation", "Ask for survey results", "Change to a different train", "Agree with every passenger"], "Staff could step in when someone repeatedly ignored requests to lower noise.", 2),
    ],
  },
];
