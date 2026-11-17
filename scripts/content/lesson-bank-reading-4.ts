import type { ReadingBankLesson, ReadingItem, ReadingKind } from "./lesson-bank-data";

// Supply the correct choice first, then place it at the requested display index.
function choice(type: ReadingKind, prompt: string, options: string[], explanation: string, position: number): ReadingItem {
  const [answer, ...arranged] = options;
  arranged.splice(position, 0, answer);
  return { type, prompt, options: arranged, answer, explanation };
}
const mc = (prompt: string, options: string[], explanation: string, p: number) => choice("MULTIPLE_CHOICE", prompt, options, explanation, p);
const main = (options: string[], explanation: string, p: number) => choice("MAIN_IDEA", "What is the passage mainly about?", options, explanation, p);
const vocab = (word: string, options: string[], explanation: string, p: number) => choice("VOCAB_IN_CONTEXT", `In the passage, "${word}" means:`, options, explanation, p);
const tf = (prompt: string, answer: "true" | "false", explanation: string): ReadingItem => ({ type: "TRUE_FALSE", prompt, answer, explanation });
const blank = (prompt: string, answer: string, explanation: string): ReadingItem => ({ type: "FILL_BLANK", prompt, answer, explanation });

export const readingLessons4: ReadingBankLesson[] = [
  {
    id: "seed-reading-34", title: "Socks in the Small Basket", topic: "Washing clothes", cefr: "A1", difficulty: "BEGINNER", estimatedMinutes: 4,
    summary: "Two sisters wash their clothes and put them in different places to dry.",
    content: `Nali and Vemi are sisters. They wash their clothes on Sunday. Nali puts white shirts in one bag. Vemi puts blue trousers in another bag. They take the bags to the wash room under their home. There are two big machines and one small table.

Nali puts the shirts in a machine. Vemi uses the other machine for the trousers. They sit on two chairs and read. After the wash, they take the wet clothes out. The shirts go outside in the sun. The trousers go there too.

Their socks are still in a small basket at home. They wash the socks by hand. Then they put them by the open window. The sisters have no more clothes to wash today.`,
    questions: [
      main(["Two sisters wash their clothes.", "Two sisters buy new clothes.", "Two sisters look for a wash room.", "Two sisters put away dry clothes."], "The sisters wash shirts, trousers and then socks.", 0),
      mc("Where is the wash room?", ["Under their home", "Next to a shop", "Behind a school", "Above their home"], "They take the bags to the wash room under their home.", 1),
      tf("The sisters use two machines for the shirts and trousers.", "true", "Nali uses one machine and Vemi uses the other machine."),
      vocab("wet", ["Not dry", "Not clean", "Very old", "Very small"], "The clothes are wet after the wash and go outside to dry.", 2),
      blank("The socks are in a small ______ at home.", "basket", "The last paragraph says the socks are still in a small basket."),
      mc("How do they wash the socks?", ["By hand", "In the first machine", "In the second machine", "With the trousers"], "The last paragraph says they wash the socks by hand.", 3),
    ],
  },
  {
    id: "seed-reading-35", title: "Shoes Below the Red Line", topic: "Putting things away", cefr: "A1", difficulty: "BEGINNER", estimatedMinutes: 4,
    summary: "A boy gives his little brother an easy place to put his shoes.",
    content: `Pavi lives with his mother and his little brother Seno. Their shoes are often on the floor by the front door. The door cannot open when the shoes are there. There is a tall shelf near the door, but Seno cannot use the top of it.

Pavi puts his own shoes on the top shelf. His mother puts her shoes in the middle. Pavi makes a red line on the bottom shelf. He tells Seno that the space below the line is for his shoes.

Seno comes home from school. He sees the line and puts his shoes under it. Now the floor is clear. Pavi opens the door and smiles. Seno likes his new space. He puts his blue boots there too.`,
    questions: [
      tf("Seno can use the top of the shelf.", "false", "The first paragraph says Seno cannot use the top of it."),
      blank("Pavi makes a red ______ on the bottom shelf.", "line", "Pavi marks the bottom shelf with a red line."),
      mc("Where does Pavi put his own shoes?", ["On the top shelf", "On the floor", "In the middle", "Under the red line"], "The second paragraph places Pavi's own shoes on the top shelf.", 2),
      main(["A boy makes a low space for his brother's shoes.", "A boy gives all his shoes to his brother.", "A boy puts a new door in his home.", "A boy looks for his brother's boots."], "Pavi gives Seno the bottom shelf and the shoes no longer block the door.", 3),
      mc("What colour are Seno's boots?", ["Blue", "Red", "Black", "White"], "The final sentence says Seno puts his blue boots there too.", 0),
      vocab("clear", ["With nothing in the way", "Full of shoes", "Red", "Closed"], "The floor is clear after Seno puts his shoes on the shelf, so the door opens.", 1),
    ],
  },
  {
    id: "seed-reading-36", title: "The Kite beyond the Trees", topic: "An outdoor afternoon", cefr: "A2", difficulty: "BEGINNER", estimatedMinutes: 5,
    summary: "Two friends find a better place to fly a kite after a quiet start.",
    content: `Last Saturday, Telo and Bina took a yellow kite to an empty field near Telo's home. Telo made the kite from thin paper and two light sticks. Bina brought a long string. They wanted to see the kite high in the sky before going home for lunch.

At first, they stood close to a row of tall trees. Telo held the kite and Bina ran with the string. The kite rose a little, then fell onto the grass. They tried three times, but the same thing happened. The air near the trees was very still.

Then Bina walked to the far side of the field. She felt more wind there, so she called Telo over. This time, the kite went up quickly. They took turns holding the string and watched its yellow shape above them. When it was time to leave, Telo slowly brought the kite down. Its paper was not broken. They carried it home and put it on a high shelf until their next free afternoon.`,
    questions: [
      vocab("still", ["Not moving", "Very warm", "Full of rain", "Difficult to see"], "The air near the trees was still, unlike the wind on the far side.", 3),
      main(["Friends move to a windier place to fly their kite.", "Friends repair a kite broken in a tree.", "Friends buy a kite after losing their own.", "Friends stop flying kites because the string breaks."], "The kite falls near the trees but flies on the windier side of the field.", 2),
      blank("Bina brought a long ______.", "string", "The opening paragraph says Bina brought a long string."),
      mc("How many times did they try near the trees?", ["Three", "Two", "Four", "Six"], "The second paragraph says they tried three times in that place.", 1),
      tf("The kite's paper was broken when they left.", "false", "The last paragraph explicitly says its paper was not broken."),
      mc("Where did they keep the kite at home?", ["On a high shelf", "Under a bed", "Beside a tree", "In a kitchen bag"], "They put the kite on a high shelf until their next free afternoon.", 0),
    ],
  },
  {
    id: "seed-reading-37", title: "A Box Too Wide for the Door", topic: "Sending a parcel", cefr: "A2", difficulty: "BEGINNER", estimatedMinutes: 5,
    summary: "A customer repacks a blanket so that its parcel fits through a collection locker door.",
    content: `On Monday, Reni packed a blanket for her cousin Omi, who lived in another town. She used a large box because it was the only empty box in her room. The blanket filled only half of it. She wrote Omi's address on the top and took the parcel to the counter at Pellu Post.

The worker, Davi, asked how Omi wanted to collect it. Reni showed him a message from her cousin. Omi wanted to use a collection locker near his home because he was often out during the day. Davi measured the box. It was too wide for the locker door, although it was not heavy.

Davi showed Reni a smaller box. She took out the blanket and folded it again. It fitted inside the smaller box, and the box fitted through the sample locker door beside the counter. Reni copied the address onto it. She kept the large box to use at home. That evening, she sent Omi a message to say the parcel was on its way to his chosen locker.`,
    questions: [
      blank("Davi ______ the box before explaining the problem.", "measured", "The second paragraph states that Davi measured the box."),
      mc("Why did Omi choose a collection locker?", ["He was often out during the day.", "He worked at Pellu Post.", "He wanted a larger blanket.", "He could not read the address."], "Omi wanted the nearby locker because he was often out during the day.", 0),
      vocab("counter", ["A desk where customers are served", "A machine for washing blankets", "A room in Omi's home", "A shelf inside a parcel"], "Reni takes the parcel to the counter, where the worker helps her send it.", 1),
      tf("The first box was too heavy for the locker.", "false", "Davi says it is too wide for the door, although it is not heavy."),
      mc("What did Reni do with the large box?", ["Kept it for use at home", "Sent it to Omi separately", "Left it inside the locker", "Gave it to Davi as a gift"], "The last paragraph says she kept the large box to use at home.", 3),
      main(["A parcel is repacked to fit a chosen collection locker.", "A parcel is returned because its address is wrong.", "A worker sends a blanket to the wrong town.", "A customer changes from a locker to home delivery."], "The smaller box solves the size problem and the parcel goes to Omi's chosen locker.", 2),
    ],
  },
  {
    id: "seed-reading-38", title: "The Fish Tank Handover", topic: "Sharing responsibilities", cefr: "B1", difficulty: "INTERMEDIATE", estimatedMinutes: 6,
    summary: "A student group introduces a shared record to prevent repeated feeding of its fish.",
    content: `The nature group at Doveli College has kept a small fish tank in its meeting room for a year. Four students share the daily tasks, but they attend the room at different times. Until recently, they relied on spoken messages to tell one another what had been done.

One Wednesday, Lera gave the fish their morning food. She told a friend in the corridor, expecting the message to reach the next person. However, the friend went straight to a lesson. When Navo arrived, he saw no sign that anyone had fed the fish. He nearly gave them another portion, but Lera returned for her notebook and stopped him.

The group has now placed a record sheet beside the tank. Whoever feeds the fish writes the time and their initials immediately afterwards. The sheet also has separate spaces for cleaning and checking the equipment. Navo thinks this is more reliable than a message which must pass through several people. Lera agrees, although she says the sheet only works if everyone remembers to complete it.

For the past two weeks, each feeding has had a single entry. The group has not changed the amount of food or the number of people helping. Instead, it has made completed work visible to the next person. Members still talk about the tank, but they no longer use conversation as their only record.`,
    questions: [
      mc("Why did Navo nearly feed the fish again?", ["He saw no sign of the earlier feeding.", "Lera asked him to give extra food.", "The record sheet showed two missed days.", "The group had bought more fish."], "Navo saw no sign anyone had fed the fish because the spoken message had not reached him.", 1),
      tf("The group has kept the amount of food the same.", "true", "The final paragraph says the group has not changed the amount of food."),
      main(["A shared record makes completed fish care visible.", "A nature group replaces all discussion with equipment checks.", "A nature group gives its fish more food each day.", "A shared tank is removed because students attend at different times."], "The group adds a written record so later visitors know which tasks are done.", 0),
      blank("Students write the time and their ______ after feeding.", "initials", "The third paragraph asks the person feeding the fish to record the time and their initials."),
      vocab("reliable", ["Able to be depended on", "Quick to erase", "Hard to understand", "Expensive to replace"], "Navo trusts the sheet more than a message passed through several people.", 3),
      mc("What limitation does Lera mention?", ["Everyone must remember to complete the sheet.", "The sheet has no space for cleaning.", "Only one student can read the sheet.", "The sheet requires a new feeding amount."], "Lera says the sheet only works if everyone remembers to complete it.", 2),
    ],
  },
  {
    id: "seed-reading-39", title: "Captions That Arrived Too Soon", topic: "Editing a video", cefr: "B1", difficulty: "INTERMEDIATE", estimatedMinutes: 6,
    summary: "A student editor learns that accurate video captions also need suitable timing.",
    content: `Savi has spent several weeks editing a short video about making paper boxes. The video shows her hands folding a sheet while her friend Kelo explains each step. Because some viewers watch without sound, she has added captions containing everything Kelo says.

At the first screening, Savi asked three classmates to follow the video and make their own boxes. She expected spelling mistakes to be the main problem. Instead, two classmates said the words appeared before the matching action. They began the next fold while Savi's hands were still finishing the previous one. The third classmate watched the whole video before starting, so he did not notice this difficulty.

Savi moved each caption so that it began when the relevant action started. She also split one long sentence into two shorter captions. She kept Kelo's wording because the instructions themselves were clear. During a second screening, the same classmates could follow the steps without asking her to pause.

Savi thinks the first test was useful because it showed how people actually used the video. She has learned that correct words alone do not make captions easy to follow. Their timing matters too. For her next project, she plans to ask viewers to perform the task during testing, rather than only ask whether the finished video looks good.`,
    questions: [
      main(["Testing reveals that captions need to match the timing of actions.", "Testing shows that all spoken instructions should be removed.", "Testing proves that spelling is the only caption problem.", "Testing leads an editor to stop showing the folding process."], "Viewers struggle with early captions, then follow the video after Savi adjusts their timing.", 3),
      vocab("relevant", ["Connected with the step concerned", "Spoken more loudly", "Finished on another day", "Hidden from the viewer"], "Each caption now begins when the action it describes starts.", 2),
      mc("Why did the third classmate miss the timing problem?", ["He watched everything before starting his box.", "He read captions in another language.", "He listened without looking at the screen.", "He had written the instructions himself."], "The third classmate watched the whole video before starting his own box.", 0),
      blank("Savi split one long ______ into two shorter captions.", "sentence", "The third paragraph says she split one long sentence into two shorter captions."),
      mc("What did Savi keep unchanged?", ["Kelo's wording", "The start time of every caption", "The length of every caption", "The original testing method for her next project"], "Savi kept Kelo's wording because the instructions themselves were clear.", 1),
      tf("The classmates needed Savi to pause during the second screening.", "false", "The same classmates could follow the steps without asking her to pause."),
    ],
  },
  {
    id: "seed-reading-40", title: "When Seed Packets Lose Their Labels", topic: "Managing a seed collection", cefr: "B2", difficulty: "ADVANCED", estimatedMinutes: 7,
    summary: "A seed collection separates uncertain packets from documented ones instead of guessing their identities.",
    content: `At the Nembrel Plant Centre, a cupboard holds seeds collected from small experimental plots. Each packet normally carries a code linking it to a notebook entry with the plant's name, collection date and plot number. During a cupboard inspection, technician Varo discovered that moisture had blurred the codes on twelve packets. The seeds themselves appeared dry, but their connection to the records had become uncertain.

One colleague suggested identifying the seeds by comparing their shapes with photographs. This would restore order quickly, yet several varieties looked almost identical. Varo argued that a confident label based only on appearance could be more misleading than no label. A later researcher might treat that guess as a documented fact.

The team therefore placed the twelve packets in a separate tray marked with their discovery date. They retained the damaged labels and photographed each packet before moving it. Seeds with readable codes remained available for planned experiments. The uncertain packets were reserved for a supervised growing trial, where additional features might help narrow the possibilities.

This decision reduced the material immediately available to researchers, and it did not guarantee that every identity would eventually be recovered. Nevertheless, the centre considered the inconvenience preferable to introducing doubtful names into its main collection. Staff also replaced the cupboard's paper labels with moisture-resistant ones. Varo described this as a practical improvement, not a reason to erase the incident from the records. The collection would be more useful if future users could distinguish what was known from what was still being investigated.`,
    questions: [
      tf("The team kept the damaged labels.", "true", "The team retained the damaged labels and photographed each packet."),
      main(["A seed collection preserves uncertainty while investigating damaged labels.", "A seed collection uses appearance to confirm every missing name.", "A seed collection discards all seeds after a cupboard inspection.", "A seed collection stops recording where its seeds came from."], "The team separates uncertain packets, retains evidence and avoids treating guesses as facts.", 1),
      mc("Why did Varo oppose identification by shape alone?", ["Several varieties looked almost identical.", "There were no photographs available.", "All twelve packets were empty.", "The notebook contained no collection dates."], "The second paragraph says several varieties looked almost identical, making shape-based guesses risky.", 2),
      vocab("retained", ["Kept", "Replaced", "Corrected", "Distributed"], "The team retained the damaged labels rather than removing that evidence of the problem.", 0),
      mc("Which seeds remained available for planned experiments?", ["Those with readable codes", "Only those in the separate tray", "Only those with blurred codes", "All seeds identified from photographs"], "The third paragraph says seeds with readable codes remained available for planned experiments.", 3),
      blank("The uncertain packets were reserved for a supervised ______ trial.", "growing", "The third paragraph names a supervised growing trial as the next investigation."),
    ],
  },
  {
    id: "seed-reading-41", title: "An Empty Hour beside the Microscope", topic: "Laboratory scheduling", cefr: "B2", difficulty: "ADVANCED", estimatedMinutes: 7,
    summary: "A laboratory changes its booking system after discovering that empty slots are difficult to use at short notice.",
    content: `The shared microscope at Velandi Research College was often fully booked a week ahead. Nevertheless, laboratory manager Orvi noticed that the room sometimes stood empty during reserved hours. Complaints about limited access therefore seemed to conflict with what she could see through the laboratory window.

Orvi compared the booking calendar with a voluntary attendance log over four weeks. Several researchers had cancelled their experiments after finding problems with prepared samples. They had told their project partners, but they had not removed their reservations. Other researchers assumed every slot displayed on the calendar was occupied and did not ask about using the equipment.

The laboratory introduced a cancellation button and an optional waiting list. When a reservation was released, the system notified people who had requested that period. However, the first week produced little improvement. A microscope session required samples to be prepared in advance, so a message arriving five minutes before a vacant hour was rarely useful. Faster communication could not remove the preparation time.

The revised arrangement now asks researchers to confirm bookings on the previous afternoon. Unconfirmed slots are released early enough for someone else to prepare. Researchers can still explain why a late cancellation was unavoidable, and the manager reviews repeated gaps individually rather than assuming deliberate misuse.

After a month, more released slots had been taken up, although access remained difficult at the busiest times. Orvi sees the change as a partial improvement. The equipment has not become more powerful, and demand has not disappeared. What has improved is the relationship between the timetable people see and the time they can realistically use.`,
    questions: [
      mc("What caused some reserved hours to remain empty?", ["Cancelled experiments were left on the calendar.", "Researchers had no way to book a week ahead.", "The microscope was moved to another college.", "The laboratory window showed the wrong room."], "Researchers cancelled experiments but did not remove their reservations.", 3),
      blank("Researchers now confirm bookings on the previous ______.", "afternoon", "The revised arrangement asks for confirmation on the previous afternoon."),
      tf("Five minutes usually gave researchers enough preparation time.", "false", "The third paragraph says a notification five minutes beforehand was rarely useful because samples needed preparation."),
      main(["A laboratory makes cancelled bookings available with usable notice.", "A laboratory eliminates all demand for its microscope.", "A laboratory replaces its microscope with a more powerful model.", "A laboratory bans every researcher who cancels a booking."], "The changes release slots earlier so others have time to prepare, producing a partial improvement.", 2),
      vocab("vacant", ["Available because nobody is using it", "Reserved for cleaning only", "Too expensive to book", "Already used the previous day"], "A vacant hour is a released period when the microscope is available.", 1),
      mc("How does the manager handle repeated gaps?", ["She reviews them individually.", "She assumes every gap is deliberate misuse.", "She deletes the attendance log.", "She stops all afternoon bookings."], "The fourth paragraph says the manager reviews repeated gaps individually.", 0),
    ],
  },
  {
    id: "seed-reading-42", title: "Who Reviews the Unfinished Question?", topic: "Research evaluation", cefr: "C1", difficulty: "ADVANCED", estimatedMinutes: 8,
    summary: "A research panel considers how early feedback can improve proposals without rewarding polished presentation over inquiry.",
    content: `At the Ordel Institute, research proposals have traditionally been assessed only after their authors have specified a question, a method and an expected contribution. A new panel has suggested offering comments at an earlier stage, when the question itself remains unsettled. Supporters argue that criticism is most useful before researchers have invested heavily in defending a particular approach. Yet the proposal raises a difficulty: an early review can quietly become an early selection process.

If reviewers reward the appearance of readiness, applicants may conceal precisely the uncertainties that discussion is intended to expose. A neatly presented question might then receive encouragement while a less fluent account of a more promising problem is set aside. The panel does not claim that clarity is irrelevant. Its concern is that clarity of presentation may be mistaken for strength of inquiry, especially when the inquiry has barely begun.

To limit this effect, the pilot separates advisory comments from decisions about access to equipment. Reviewers must identify an assumption worth testing and explain what evidence could change their initial interpretation. Applicants may respond with a revised question rather than a defence of the original one. The panel will examine those revisions, alongside anonymous participant reports, when evaluating the pilot.

These arrangements cannot make feedback neutral. Even a helpful suggestion directs attention towards some possibilities and away from others. Nevertheless, making that influence discussable may be preferable to treating an expert's first reaction as an objective verdict. The pilot's value will therefore depend less on how many initial proposals survive unchanged than on whether participants can show how criticism helped them formulate a more productive uncertainty.`,
    questions: [
      vocab("verdict", ["A judgement treated as settled", "A request for more equipment", "A description of a participant", "An unanswered research question"], "The final paragraph warns against treating an expert's first reaction as an objective, settled judgement.", 2),
      tf("The pilot separates advisory comments from decisions about equipment access.", "true", "The third paragraph explicitly separates these two parts of the pilot."),
      mc("What risk arises if reviewers reward apparent readiness?", ["Applicants may hide uncertainties that need discussion.", "Applicants must abandon clear writing entirely.", "Reviewers will no longer influence research questions.", "Equipment decisions will automatically become anonymous."], "The second paragraph says applicants may conceal the uncertainties discussion is intended to expose.", 1),
      main(["Early research feedback needs conditions that allow uncertainty and revision.", "Early research feedback succeeds when every original question survives.", "Early research feedback should select only the most polished proposals.", "Early research feedback can become completely neutral through anonymous reports."], "The passage supports early feedback while examining how selection pressures and expert influence may limit it.", 0),
      blank("Reviewers must identify an ______ worth testing.", "assumption", "The pilot requires reviewers to identify an assumption worth testing and describe relevant evidence."),
      mc("What would best support the pilot's value under the final paragraph's criterion?", ["Participants explain how criticism improved the uncertainty they investigate.", "Every applicant defends the first question without revision.", "Reviewers report that their first reactions cannot be questioned.", "The panel counts only proposals that remain unchanged."], "The final sentence values showing how criticism helped formulate a more productive uncertainty.", 3),
    ],
  },
];
