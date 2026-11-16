/**
 * Additional demo lessons and prompts (fifty per skill after the fifth batch).
 *
 * Data only: `seed-lesson-bank.ts` writes it (create-only) and
 * `check-lesson-bank.ts` validates it offline. Ids are deterministic and
 * continue the existing `seed-<skill>-<n>` numbering (1-2 / 1-2 / 1-3 / 1-3
 * already exist).
 */

import { moreWritingPrompts, moreSpeakingPrompts } from "./lesson-bank-more-prompts";
import { readingLessons2 } from "./lesson-bank-reading-2";
import { listeningLessons2 } from "./lesson-bank-listening-2";
import { writingPrompts2, speakingPrompts2 } from "./lesson-bank-prompts-2";
import { readingLessons3 } from "./lesson-bank-reading-3";
import { listeningLessons3 } from "./lesson-bank-listening-3";
import { writingPrompts3, speakingPrompts3 } from "./lesson-bank-prompts-3";
import { readingLessons4 } from "./lesson-bank-reading-4";
import { listeningLessons4 } from "./lesson-bank-listening-4";
import { writingPrompts4, speakingPrompts4 } from "./lesson-bank-prompts-4";
import { readingLessons5 } from "./lesson-bank-reading-5";
import { listeningLessons5 } from "./lesson-bank-listening-5";
import { writingPrompts5, speakingPrompts5 } from "./lesson-bank-prompts-5";
import { moreListeningLessons, moreReadingLessons } from "./lesson-bank-more-reading-listening";

export type Level = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

/**
 * Finer level for later grouping (data only, not stored in the database yet).
 * Mapping to the stored level: A1 and A2 are BEGINNER, B1 is INTERMEDIATE,
 * B2 and C1 are ADVANCED. Items written before the third batch have none.
 */
export type Cefr = "A1" | "A2" | "B1" | "B2" | "C1";

export type ReadingKind =
  | "MULTIPLE_CHOICE"
  | "TRUE_FALSE"
  | "FILL_BLANK"
  | "MAIN_IDEA"
  | "VOCAB_IN_CONTEXT";

export type ReadingItem = {
  type: ReadingKind;
  prompt: string;
  options?: string[];
  /** Text of the correct option, "true"/"false", or the expected word. */
  answer: string;
  accepted?: string[];
  explanation: string;
};

export type ReadingBankLesson = {
  id: string;
  title: string;
  topic: string;
  difficulty: Level;
  cefr?: Cefr;
  estimatedMinutes: number;
  summary: string;
  content: string;
  questions: ReadingItem[];
};

export type ListeningKind =
  | "MULTIPLE_CHOICE"
  | "TRUE_FALSE"
  | "FILL_BLANK"
  | "MATCHING";

export type ListeningItem = {
  type: ListeningKind;
  prompt: string;
  options?: string[];
  pairs?: { left: string; right: string }[];
  answer?: string;
  accepted?: string[];
  explanation: string;
};

export type ListeningBankLesson = {
  id: string;
  title: string;
  topic: string;
  difficulty: Level;
  cefr?: Cefr;
  transcript: string;
  questions: ListeningItem[];
};

export type WritingBankPrompt = {
  id: string;
  title: string;
  topic: string;
  difficulty: Level;
  cefr?: Cefr;
  minWords: number;
  maxWords: number;
  promptText: string;
};

export type SpeakingBankPrompt = {
  id: string;
  title: string;
  topic: string;
  difficulty: Level;
  cefr?: Cefr;
  preparationSeconds: number;
  speakingSeconds: number;
  promptText: string;
};

const baseReadingLessons: ReadingBankLesson[] = [
  {
    id: "seed-reading-3",
    title: "Lost Luggage at the Airport",
    topic: "Travel",
    difficulty: "BEGINNER",
    estimatedMinutes: 5,
    summary: "A traveller's suitcase does not arrive, and the airport helps.",
    content: `Daniel landed in Lisbon at six in the evening, tired after a long flight from Toronto. He waited at the baggage belt for forty minutes, but his blue suitcase never appeared. When the belt stopped, he walked to the lost luggage desk.

A young woman named Ana gave him a form. She asked him to describe the suitcase and to write down the address of his hotel. "Most bags arrive on the next flight," she said. "We will deliver it to your hotel, so you do not need to come back to the airport."

Daniel was worried because his medicine and his laptop charger were inside the suitcase. Ana found him a small emergency kit with a toothbrush and a clean T-shirt. She also gave him a phone number to call if the bag had not arrived by noon the next day.

The suitcase arrived at his hotel at ten the next morning. Daniel thanked the receptionist and went straight to his room to unpack.`,
    questions: [
      {
        type: "MULTIPLE_CHOICE",
        prompt: "Why did Daniel go to the lost luggage desk?",
        options: [
          "His flight was cancelled.",
          "He lost his passport.",
          "He missed a connecting flight.",
          "His suitcase did not arrive.",
        ],
        answer: "His suitcase did not arrive.",
        explanation:
          "He waited forty minutes at the belt, and \"his blue suitcase never appeared\".",
      },
      {
        type: "TRUE_FALSE",
        prompt: "Daniel had to return to the airport to collect his bag.",
        answer: "false",
        explanation:
          "Ana said the airport would deliver the bag to his hotel, so he did not need to come back.",
      },
      {
        type: "FILL_BLANK",
        prompt: "Ana asked Daniel to write down the address of his ______.",
        answer: "hotel",
        accepted: ["the hotel"],
        explanation: "She asked for \"the address of his hotel\" on the form.",
      },
      {
        type: "VOCAB_IN_CONTEXT",
        prompt: 'In the passage, "deliver" means:',
        options: [
          "Bring something to a place",
          "Repair something",
          "Pay for something",
          "Describe something",
        ],
        answer: "Bring something to a place",
        explanation:
          "\"We will deliver it to your hotel\" means the airport will bring the suitcase to the hotel.",
      },
      {
        type: "MAIN_IDEA",
        prompt: "What is the passage mainly about?",
        options: [
          "Why flights from Toronto are so long",
          "How to pack a suitcase for a trip",
          "How an airport helped a traveller whose bag was lost",
          "A holiday in Lisbon",
        ],
        answer: "How an airport helped a traveller whose bag was lost",
        explanation:
          "The whole passage follows Daniel's missing suitcase and the help he receives until it arrives.",
      },
    ],
  },
  {
    id: "seed-reading-4",
    title: "The Four-Day Week Experiment",
    topic: "Work",
    difficulty: "INTERMEDIATE",
    estimatedMinutes: 7,
    summary: "What happened when companies cut the working week without cutting pay.",
    content: `In 2022, dozens of British companies tried something unusual: they asked employees to work four days a week while receiving the same pay as before. The pilot, which lasted six months, was designed by researchers who wanted to find out whether shorter weeks could be as productive as traditional ones.

The results surprised many sceptics. Most companies reported that revenue stayed roughly the same, and several said it had risen. Staff said they felt less stressed, and fewer of them left their jobs during the trial. Almost all of the participating firms chose to continue the four-day schedule once the pilot ended.

Supporters argue that the benefits come from focus rather than from hours. When employees know they have less time, they cut unnecessary meetings and avoid distractions. Critics, however, point out that the experiment involved mostly small companies in office-based sectors. A hospital or a factory, they say, cannot simply close for an extra day, because patients and production lines do not stop.

The debate is therefore unlikely to end soon. What the trial did show is that the length of the working week is a choice, not a law of nature, and that choice can be tested with evidence.`,
    questions: [
      {
        type: "MULTIPLE_CHOICE",
        prompt: "How were employees paid during the trial?",
        options: [
          "Less than before",
          "The same as before",
          "More than before",
          "According to the hours they worked",
        ],
        answer: "The same as before",
        explanation:
          "Employees worked four days \"while receiving the same pay as before\".",
      },
      {
        type: "TRUE_FALSE",
        prompt: "Revenue fell sharply at most of the companies.",
        answer: "false",
        explanation:
          "Most companies reported that revenue stayed roughly the same, and several said it had risen.",
      },
      {
        type: "FILL_BLANK",
        prompt:
          "Almost all of the firms chose to ______ the four-day schedule after the pilot ended.",
        answer: "continue",
        accepted: ["keep"],
        explanation:
          "The passage says almost all participating firms \"chose to continue\" the schedule.",
      },
      {
        type: "VOCAB_IN_CONTEXT",
        prompt: 'As used in the passage, "sceptics" are people who:',
        options: [
          "Doubt that something will work",
          "Design research studies",
          "Manage large companies",
          "Work shorter hours",
        ],
        answer: "Doubt that something will work",
        explanation:
          "The results \"surprised many sceptics\", meaning people who expected the idea to fail.",
      },
      {
        type: "MULTIPLE_CHOICE",
        prompt: "Why do critics question whether the results apply everywhere?",
        options: [
          "The trial was too short to measure anything.",
          "The companies were not paid fairly.",
          "The trial mostly involved small, office-based companies.",
          "Employees did not want a shorter week.",
        ],
        answer: "The trial mostly involved small, office-based companies.",
        explanation:
          "Critics note that hospitals and factories cannot simply close for a day, unlike the mostly office-based firms in the pilot.",
      },
      {
        type: "MAIN_IDEA",
        prompt: "Which sentence best summarises the passage?",
        options: [
          "Every company should switch to a four-day week immediately.",
          "Employees work harder when they are paid less.",
          "Shorter weeks always reduce company revenue.",
          "A trial suggests shorter weeks can work, though perhaps not in every sector.",
        ],
        answer:
          "A trial suggests shorter weeks can work, though perhaps not in every sector.",
        explanation:
          "The passage reports positive results and then explains why critics doubt they would apply to every kind of workplace.",
      },
    ],
  },
  {
    id: "seed-reading-5",
    title: "Why Bees Matter More Than Honey",
    topic: "Science",
    difficulty: "ADVANCED",
    estimatedMinutes: 9,
    summary: "The role of bees in food production and why their numbers are falling.",
    content: `When people think of bees, they usually think of honey. Yet the honey a hive produces is a small part of the bee's value. Roughly three-quarters of the world's major food crops depend, at least in part, on animal pollinators, and bees are the most important of them. Almonds, apples, blueberries and coffee all rely heavily on these insects.

Pollination happens almost by accident. As a bee moves from flower to flower collecting nectar, grains of pollen stick to its body and are carried to the next plant, allowing it to produce seeds and fruit. Without this transfer, many crops would yield far less, and some would fail altogether.

In recent decades, beekeepers in several countries have reported sharp declines in colonies. Scientists rarely blame a single cause. Pesticides, the loss of wild flowers, parasites and changing weather patterns all appear to play a part, and their effects can combine in ways that are difficult to predict. A colony weakened by one threat is often less able to withstand another.

Farmers have responded in different ways. Some now rent hives for the flowering season, transporting millions of bees to orchards by lorry. Others plant strips of wild flowers along the edges of their fields to provide food throughout the year. These measures help, but researchers caution that managed honeybees cannot replace the many wild species that also pollinate crops. Protecting a variety of habitats, they argue, is more effective than depending on a single, commercially managed insect.`,
    questions: [
      {
        type: "MULTIPLE_CHOICE",
        prompt:
          "What proportion of major food crops depend at least partly on animal pollinators?",
        options: [
          "About a quarter",
          "About half",
          "Roughly three-quarters",
          "Almost all of them",
        ],
        answer: "Roughly three-quarters",
        explanation:
          "The first paragraph says \"roughly three-quarters\" of major food crops depend at least in part on animal pollinators.",
      },
      {
        type: "TRUE_FALSE",
        prompt:
          "Scientists have shown that pesticides are the only cause of falling bee numbers.",
        answer: "false",
        explanation:
          "The passage says scientists \"rarely blame a single cause\" and lists several factors that combine.",
      },
      {
        type: "FILL_BLANK",
        prompt: "Some farmers ______ hives for the flowering season.",
        answer: "rent",
        accepted: ["hire"],
        explanation: "The fourth paragraph says some farmers \"now rent hives\".",
      },
      {
        type: "VOCAB_IN_CONTEXT",
        prompt: 'In the third paragraph, "withstand" most nearly means:',
        options: [
          "Survive or resist",
          "Produce or create",
          "Observe or measure",
          "Move or transport",
        ],
        answer: "Survive or resist",
        explanation:
          "A colony weakened by one threat is less able to survive or resist another.",
      },
      {
        type: "MULTIPLE_CHOICE",
        prompt: "Why do researchers say managed honeybees are not enough?",
        options: [
          "They produce too little honey.",
          "They are too expensive for most farmers.",
          "Wild species also pollinate crops and cannot be replaced by them.",
          "They only pollinate almonds.",
        ],
        answer: "Wild species also pollinate crops and cannot be replaced by them.",
        explanation:
          "Researchers caution that managed honeybees \"cannot replace the many wild species\" that also pollinate crops.",
      },
      {
        type: "MAIN_IDEA",
        prompt: "Which statement best expresses the main idea?",
        options: [
          "Bees are valuable mainly for pollination, and protecting them needs more than one solution.",
          "Honey is the most important product of bees.",
          "Farmers should stop using lorries to move hives.",
          "Weather is the main reason for the decline of bees.",
        ],
        answer:
          "Bees are valuable mainly for pollination, and protecting them needs more than one solution.",
        explanation:
          "The passage moves from the importance of pollination, to the causes of decline, to varied responses and habitat protection.",
      },
    ],
  },
  {
    id: "seed-reading-6",
    title: "The Hidden Cost of Fast Fashion",
    topic: "Society",
    difficulty: "ADVANCED",
    estimatedMinutes: 9,
    summary: "Why very cheap clothes carry costs that do not appear on the price tag.",
    content: `A T-shirt that costs less than a sandwich can seem like a bargain. Fast-fashion companies make this possible by producing large quantities of cheap clothes quickly, releasing new designs every few weeks rather than every season. Shoppers respond by buying more and keeping garments for a shorter time. Estimates suggest that the average item is worn only a handful of times before it is thrown away.

The price tag hides several costs. Producing cotton requires large amounts of water, and dyeing fabric can pollute rivers near factories. Many garments are also made from synthetic fibres such as polyester, which release tiny plastic particles every time they are washed. Meanwhile, the workers who sew the clothes are often paid very little, and safety standards in some factories remain poor.

Defenders of the industry point out that inexpensive clothing makes fashion accessible to people on low incomes, and that millions of jobs in developing countries depend on garment exports. They argue that sudden changes in buying habits could harm the very workers campaigners hope to protect.

A growing number of consumers are looking for a middle path. Buying fewer, better-made items, repairing clothes, and choosing second-hand shops can all reduce waste without destroying demand for labour. Some brands now offer repair services or take back old garments for recycling. Whether these initiatives amount to real change or merely good marketing is still hotly debated.`,
    questions: [
      {
        type: "MULTIPLE_CHOICE",
        prompt: "What makes fast fashion different from traditional clothing retail?",
        options: [
          "It uses only natural fibres.",
          "It releases new designs every few weeks rather than every season.",
          "It sells only to people on high incomes.",
          "It produces clothes in small quantities.",
        ],
        answer: "It releases new designs every few weeks rather than every season.",
        explanation:
          "The first paragraph says new designs appear \"every few weeks rather than every season\".",
      },
      {
        type: "TRUE_FALSE",
        prompt: "Clothes made from polyester can release tiny plastic particles when washed.",
        answer: "true",
        explanation:
          "Synthetic fibres such as polyester \"release tiny plastic particles every time they are washed\".",
      },
      {
        type: "FILL_BLANK",
        prompt: "Producing cotton requires large amounts of ______.",
        answer: "water",
        explanation: "The second paragraph states that cotton \"requires large amounts of water\".",
      },
      {
        type: "VOCAB_IN_CONTEXT",
        prompt: 'In the third paragraph, "accessible" most nearly means:',
        options: [
          "Easy for people to obtain or afford",
          "Fashionable and modern",
          "Made from recycled materials",
          "Difficult to find",
        ],
        answer: "Easy for people to obtain or afford",
        explanation:
          "Inexpensive clothing makes fashion available to people on low incomes, so \"accessible\" means within their reach.",
      },
      {
        type: "MULTIPLE_CHOICE",
        prompt: "What do defenders of the industry fear could happen if buying habits changed suddenly?",
        options: [
          "Clothes would become more expensive for everyone.",
          "Garment workers could lose their jobs.",
          "Factories would produce more waste.",
          "Second-hand shops would close.",
        ],
        answer: "Garment workers could lose their jobs.",
        explanation:
          "They argue that sudden changes \"could harm the very workers campaigners hope to protect\", because millions of jobs depend on exports.",
      },
      {
        type: "MAIN_IDEA",
        prompt: "What is the main idea of the passage?",
        options: [
          "Cheap clothes are always a good thing for shoppers.",
          "The low price of fast fashion hides environmental and human costs, and the best response is still debated.",
          "Cotton is a better fabric than polyester.",
          "Brands should stop selling clothes altogether.",
        ],
        answer:
          "The low price of fast fashion hides environmental and human costs, and the best response is still debated.",
        explanation:
          "The passage describes the hidden costs, the defence of the industry, and uncertain progress towards better practice.",
      },
    ],
  },
];

const baseListeningLessons: ListeningBankLesson[] = [
  {
    id: "seed-listening-3",
    title: "Station Announcements",
    topic: "Travel",
    difficulty: "BEGINNER",
    transcript:
      "Good afternoon, passengers. This is an announcement for Riverside Station. The train to Manchester, which was due to leave from platform four at two fifteen, has been delayed by twenty minutes. It will now leave at two thirty-five from platform six. Please take the stairs next to the cafe to reach platform six. We apologise for the inconvenience. Passengers travelling to Leeds should note that there are no direct trains this afternoon because of engineering work. Please take the two forty train to York and change there. The journey to Leeds will take about two hours, which is thirty minutes longer than usual. Tickets will be accepted on the replacement service at no extra cost. Finally, a reminder that the ticket office closes at six o'clock this evening. After that time, tickets can be bought from the machines near the main entrance. If you need help, please ask a member of staff in a yellow jacket. Thank you for travelling with Riverside Railways, and enjoy your journey.",
    questions: [
      {
        type: "MULTIPLE_CHOICE",
        prompt: "How long is the delay to the Manchester train?",
        options: ["Ten minutes", "Twenty minutes", "Thirty-five minutes", "Forty minutes"],
        answer: "Twenty minutes",
        explanation: "The announcement says the train \"has been delayed by twenty minutes\".",
      },
      {
        type: "FILL_BLANK",
        prompt: "The Manchester train will now leave from platform ______.",
        answer: "six",
        accepted: ["six", "6"],
        explanation: "It was due to leave from platform four but \"will now leave at two thirty-five from platform six\".",
      },
      {
        type: "TRUE_FALSE",
        prompt: "Passengers going to Leeds need to change trains at York.",
        answer: "true",
        explanation: "The announcement says to \"take the two forty train to York and change there\".",
      },
      {
        type: "MULTIPLE_CHOICE",
        prompt: "Why are there no direct trains to Leeds this afternoon?",
        options: ["A strike", "Engineering work", "Bad weather", "A broken signal"],
        answer: "Engineering work",
        explanation: "There are no direct trains \"because of engineering work\".",
      },
      {
        type: "MATCHING",
        prompt: "Match each place or person with the information given.",
        pairs: [
          { left: "The ticket office", right: "Closes at six o'clock" },
          { left: "The ticket machines", right: "Near the main entrance" },
          { left: "A member of staff", right: "Wears a yellow jacket" },
        ],
        explanation:
          "The office closes at six, the machines are by the main entrance, and staff can be recognised by their yellow jackets.",
      },
    ],
  },
  {
    id: "seed-listening-4",
    title: "Welcome Talk for New Students",
    topic: "Education",
    difficulty: "INTERMEDIATE",
    transcript:
      "Hello, everyone, and welcome to Hillcrest University. My name is Priya, and I am one of the student advisers here. I would like to spend the next few minutes explaining the services that can help you during your first term. First, the library. It is open from eight in the morning until ten at night on weekdays, and until five on Saturdays. You can borrow up to ten books at a time, and there are quiet study rooms that you can reserve online. The library also runs a free workshop every Wednesday on how to find reliable sources for your essays. Second, if you are worried about your English or your academic writing, visit the Language Centre in the Atlas building. Appointments are free, and tutors can read through a draft with you for twenty minutes. Many students tell me this is the most useful hour of their week, so please do not wait until just before a deadline. Finally, join a club. We have more than eighty, from chess to mountain walking. The clubs fair takes place on the main lawn next Thursday, and if it rains, it will move into the sports hall. Remember, making friends early makes university much more enjoyable. Thank you, and good luck.",
    questions: [
      {
        type: "MULTIPLE_CHOICE",
        prompt: "Who is the speaker?",
        options: ["A librarian", "A language tutor", "The university president", "A student adviser"],
        answer: "A student adviser",
        explanation: "She says: \"I am one of the student advisers here.\"",
      },
      {
        type: "FILL_BLANK",
        prompt: "Students can borrow up to ______ books at a time.",
        answer: "ten",
        accepted: ["ten", "10"],
        explanation: "The speaker says you can \"borrow up to ten books at a time\".",
      },
      {
        type: "MULTIPLE_CHOICE",
        prompt: "When does the library run a workshop on finding reliable sources?",
        options: ["Every Monday", "Every Wednesday", "Every Friday", "On Saturdays only"],
        answer: "Every Wednesday",
        explanation: "The workshop is free and runs \"every Wednesday\".",
      },
      {
        type: "TRUE_FALSE",
        prompt: "Students must pay a small fee for Language Centre appointments.",
        answer: "false",
        explanation: "The speaker says \"Appointments are free\".",
      },
      {
        type: "MATCHING",
        prompt: "Match each service with what the speaker says about it.",
        pairs: [
          { left: "The library", right: "Quiet rooms you can reserve online" },
          { left: "The Language Centre", right: "Feedback on a draft of your writing" },
          { left: "The clubs fair", right: "Moves to the sports hall if it rains" },
        ],
        explanation:
          "Study rooms can be reserved online, tutors read drafts for twenty minutes, and the clubs fair moves indoors in bad weather.",
      },
      {
        type: "MULTIPLE_CHOICE",
        prompt: "Where will the clubs fair take place if the weather is dry?",
        options: ["In the sports hall", "On the main lawn", "In the Atlas building", "In the library"],
        answer: "On the main lawn",
        explanation: "It \"takes place on the main lawn next Thursday\" and only moves indoors if it rains.",
      },
    ],
  },
  {
    id: "seed-listening-5",
    title: "A Lecture on Sleep and Memory",
    topic: "Science",
    difficulty: "ADVANCED",
    transcript:
      "Today I would like to talk about why we sleep, and in particular what happens to memory when we do. For a long time, scientists assumed that sleep was simply a period of rest. We now know that the brain is remarkably active at night. In one well-known study, researchers asked two groups of students to learn a list of word pairs in the evening. One group slept normally. The other stayed awake all night. When both groups were tested two days later, after everyone had caught up on sleep, the students who had slept straight after learning remembered about forty per cent more of the pairs. Why should this be? One explanation is that during deep sleep the brain replays the day's experiences and moves important information from short-term to long-term storage. In other words, sleep does not just protect memory, it organises it. There are, of course, limits to these findings. The study involved only young adults, and it is not yet clear whether the effect is the same for older people. Nevertheless, the practical advice is clear. Studying late into the night and sacrificing sleep may feel productive, but it is likely to be counterproductive. For next week, please read the two articles on the course page, and think about how you would design a study that includes older participants.",
    questions: [
      {
        type: "MULTIPLE_CHOICE",
        prompt: "What did scientists believe about sleep for a long time?",
        options: [
          "That it was simply a period of rest",
          "That it improved eyesight",
          "That it was not necessary for adults",
          "That the brain stops working during it",
        ],
        answer: "That it was simply a period of rest",
        explanation: "The lecturer says scientists \"assumed that sleep was simply a period of rest\".",
      },
      {
        type: "FILL_BLANK",
        prompt: "The students who slept remembered about ______ per cent more of the word pairs.",
        answer: "forty",
        accepted: ["forty", "40"],
        explanation: "They \"remembered about forty per cent more of the pairs\".",
      },
      {
        type: "TRUE_FALSE",
        prompt: "Both groups of students were tested on the evening they learned the words.",
        answer: "false",
        explanation: "Both groups were tested \"two days later\", after catching up on sleep.",
      },
      {
        type: "MULTIPLE_CHOICE",
        prompt: "What explanation does the lecturer give for the result?",
        options: [
          "Sleeping students study harder the next day.",
          "Staying awake damages the ears.",
          "During deep sleep the brain moves information into long-term storage.",
          "Word pairs are easier to remember in the morning.",
        ],
        answer: "During deep sleep the brain moves information into long-term storage.",
        explanation:
          "She says the brain \"moves important information from short-term to long-term storage\" during deep sleep.",
      },
      {
        type: "MULTIPLE_CHOICE",
        prompt: "What limitation of the study does the lecturer mention?",
        options: [
          "It lasted only one night.",
          "It used too few word pairs.",
          "Only young adults took part.",
          "The students were not tested.",
        ],
        answer: "Only young adults took part.",
        explanation: "She notes that the study \"involved only young adults\".",
      },
    ],
  },
  {
    id: "seed-listening-6",
    title: "Podcast: The Independent Bookshop",
    topic: "Business",
    difficulty: "ADVANCED",
    transcript:
      "Welcome back to Market Street, the podcast about how people make a living. This week we are talking about independent bookshops, which many people predicted would disappear a decade ago. Online retailers sell books at lower prices and deliver them to your door, so the future looked bleak. Yet in several countries, the number of independent bookshops has actually grown since two thousand and fifteen. I spoke to Helen Marsh, who runs a shop called The Reading Room in a small coastal town. She told me that she cannot compete on price, so she does not try. Instead, she organises author evenings, runs a children's story hour on Saturday mornings, and recommends books personally to her regular customers. According to Helen, people come to a bookshop for the experience as much as for the book. She also admitted that the business is fragile. Rent has risen by almost a third in five years, and in winter she sometimes goes a whole afternoon without a single customer. Last year she began selling coffee and cake, which now brings in about a fifth of her income. Later in the programme, we will hear from an economist who argues that shops like Helen's survive because they offer something an algorithm cannot: trust. But first, here is some music.",
    questions: [
      {
        type: "MULTIPLE_CHOICE",
        prompt: "What did many people predict about independent bookshops a decade ago?",
        options: [
          "That they would disappear",
          "That they would become cheaper",
          "That they would open longer hours",
          "That they would sell coffee",
        ],
        answer: "That they would disappear",
        explanation: "The host says many people \"predicted would disappear a decade ago\".",
      },
      {
        type: "MULTIPLE_CHOICE",
        prompt: "How does Helen Marsh compete with online retailers?",
        options: [
          "By lowering her prices",
          "By offering events and personal recommendations",
          "By delivering books to customers' homes",
          "By opening a second shop",
        ],
        answer: "By offering events and personal recommendations",
        explanation:
          "She \"cannot compete on price, so she does not try\"; instead she runs events and recommends books personally.",
      },
      {
        type: "FILL_BLANK",
        prompt: "In five years, rent has risen by almost a ______.",
        answer: "third",
        accepted: ["third", "one third", "1/3"],
        explanation: "The host says rent \"has risen by almost a third in five years\".",
      },
      {
        type: "TRUE_FALSE",
        prompt: "Coffee and cake now bring in about half of Helen's income.",
        answer: "false",
        explanation: "They bring in \"about a fifth of her income\", not half.",
      },
      {
        type: "MATCHING",
        prompt: "Match each item from the programme with what is said about it.",
        pairs: [
          { left: "Saturday mornings", right: "A children's story hour" },
          { left: "The rent", right: "Up by almost a third" },
          { left: "The economist", right: "Says shops offer trust" },
        ],
        explanation:
          "The shop holds a story hour on Saturdays, rent has risen by almost a third, and the economist argues that shops offer trust.",
      },
    ],
  },
];

export const readingLessons: ReadingBankLesson[] = [...baseReadingLessons, ...moreReadingLessons, ...readingLessons2, ...readingLessons3, ...readingLessons4, ...readingLessons5];
export const listeningLessons: ListeningBankLesson[] = [...baseListeningLessons, ...moreListeningLessons, ...listeningLessons2, ...listeningLessons3, ...listeningLessons4, ...listeningLessons5];

const baseWritingPrompts: WritingBankPrompt[] = [
  {
    id: "seed-writing-4",
    title: "A Day Out I Enjoyed",
    topic: "Daily life",
    difficulty: "BEGINNER",
    minWords: 80,
    maxWords: 120,
    promptText:
      "Your English teacher has asked everyone in the class to write about a day out they enjoyed.\n\nWrite a short story about one day you spent away from home, with friends, family or on your own. Say where you went, what happened first, next and last, and how you felt at the end. Use past tenses and time words such as first, then, after that and finally.",
  },
  {
    id: "seed-writing-5",
    title: "A Noisy Place to Study",
    topic: "Education",
    difficulty: "INTERMEDIATE",
    minWords: 150,
    maxWords: 200,
    promptText:
      "Your college library has become too noisy for students to concentrate. The student newspaper is asking readers for ideas.\n\nWrite a problem-solution article. Describe the problem and explain why it matters. Then suggest two realistic solutions and say which one you think would work best and why. Organise your ideas into clear paragraphs and use linking words such as however, as a result and for this reason.",
  },
  {
    id: "seed-writing-6",
    title: "Working from Home: Benefits and Drawbacks",
    topic: "Work",
    difficulty: "ADVANCED",
    minWords: 220,
    maxWords: 280,
    promptText:
      "More and more companies now allow employees to work from home for part of the week, or even full time.\n\nWrite an essay discussing the advantages and disadvantages of working from home. Consider the point of view of employees and the point of view of employers, then give your own conclusion. Support each point with a reason or an example, and use a formal, balanced style.",
  },
];

const baseSpeakingPrompts: SpeakingBankPrompt[] = [
  {
    id: "seed-speaking-4",
    title: "Your Favourite Food",
    topic: "Food",
    difficulty: "BEGINNER",
    preparationSeconds: 15,
    speakingSeconds: 60,
    promptText:
      "Talk about a food or meal that you really enjoy.\n\nSay what it is, when you usually eat it, and what it tastes like. Explain why you like it and who you like to share it with. Try to use describing words such as sweet, spicy, crunchy or fresh.",
  },
  {
    id: "seed-speaking-5",
    title: "Learning Something New",
    topic: "Education",
    difficulty: "INTERMEDIATE",
    preparationSeconds: 30,
    speakingSeconds: 90,
    promptText:
      "Think about a skill or hobby that you have learned, or would like to learn, such as cooking, drawing, swimming or playing an instrument.\n\nExplain what it is and why you chose it. Describe how you learn it, or how you would start, and mention one difficulty you have had or expect to have. Finish by saying what advice you would give to a beginner.",
  },
  {
    id: "seed-speaking-6",
    title: "Studying Alone or in a Group?",
    topic: "Education",
    difficulty: "ADVANCED",
    preparationSeconds: 45,
    speakingSeconds: 120,
    promptText:
      "Some people believe they learn best when they study alone. Others say that working with classmates is far more effective.\n\nGive your opinion on which approach is better. Support your view with two reasons and an example from your own experience or from people you know. Then say when the other approach might be more useful. Organise your answer clearly, with an opening, your main points and a short conclusion.",
  },
];

export const writingPrompts: WritingBankPrompt[] = [...baseWritingPrompts, ...moreWritingPrompts, ...writingPrompts2, ...writingPrompts3, ...writingPrompts4, ...writingPrompts5];
export const speakingPrompts: SpeakingBankPrompt[] = [...baseSpeakingPrompts, ...moreSpeakingPrompts, ...speakingPrompts2, ...speakingPrompts3, ...speakingPrompts4, ...speakingPrompts5];
