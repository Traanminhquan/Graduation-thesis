import type { ReadingBankLesson, ReadingItem, ReadingKind } from "./lesson-bank-data";

// Supply the correct choice first, then place it at the requested index.
function choice(type: ReadingKind, prompt: string, options: string[], explanation: string, position: number): ReadingItem {
  const [answer, ...rest] = options;
  rest.splice(position, 0, answer);
  return { type, prompt, options: rest, answer, explanation };
}
const mc = (prompt: string, options: string[], explanation: string, p: number) => choice("MULTIPLE_CHOICE", prompt, options, explanation, p);
const main = (options: string[], explanation: string, p: number) => choice("MAIN_IDEA", "What is the passage mainly about?", options, explanation, p);
const vocab = (word: string, options: string[], explanation: string, p: number) => choice("VOCAB_IN_CONTEXT", `In the passage, "${word}" means:`, options, explanation, p);
const tf = (prompt: string, answer: "true" | "false", explanation: string): ReadingItem => ({ type: "TRUE_FALSE", prompt, answer, explanation });
const blank = (prompt: string, answer: string, explanation: string): ReadingItem => ({ type: "FILL_BLANK", prompt, answer, explanation });

export const readingLessons5: ReadingBankLesson[] = [
  {
    id: "seed-reading-43", title: "A Name for the Snow Friend", topic: "Winter play", cefr: "A1", difficulty: "BEGINNER", estimatedMinutes: 4,
    summary: "Two children make a snow friend and choose a name for it.",
    content: `There is snow in the garden today. Nalo and his sister Esi go outside after breakfast. They have warm coats and red hats. They make three snow balls. One is small. The small ball goes on top. Now their snow friend has a head and a body.

Esi puts two stones on its face for eyes. Nalo has a carrot for its nose. They put an old blue hat on its head. The hat is too big for Esi, but it is good for the snow friend.

They call it Bim. Their father looks out of the window. He likes Bim and takes a picture. The children stand next to Bim for the picture. Then they go inside for warm milk.`,
    questions: [
      main(["Two children make and name a snow friend.", "Two children buy hats for a snow friend.", "Two children draw a snow friend indoors.", "Two children look for a lost snow friend."], "The children build the snow friend in the garden and call it Bim.", 0),
      blank("Bim has a ______ for a nose.", "carrot", "Nalo has a carrot for the snow friend's nose."),
      mc("Where do the children make Bim?", ["In the garden", "In the kitchen", "At school", "By a shop"], "The passage begins with snow in the garden, where they go outside to build Bim.", 1),
      vocab("next to", ["Beside", "Under", "Inside", "Far from"], "The children stand beside Bim when their father takes the picture.", 2),
      tf("The old blue hat is too small for Esi.", "false", "The text says the old blue hat is too big for Esi."),
      mc("What do the children drink at the end?", ["Warm milk", "Cold water", "Orange juice", "Hot tea"], "The last sentence says they go inside for warm milk.", 3),
    ],
  },
  {
    id: "seed-reading-44", title: "The Lift to Floor Six", topic: "Going upstairs", cefr: "A1", difficulty: "BEGINNER", estimatedMinutes: 4,
    summary: "A girl takes a lift with her father to reach his office.",
    content: `Rina goes to her father's office on Sunday. His office is on floor six of a tall building. Rina goes there with her father. They have a bag of oranges for the office. The bag is heavy, so her father carries it.

Inside the building, they see a lift. Rina presses the button beside the door. The door opens and they go in. Her father says, "We want floor six." Rina finds the number six and presses it. The lift goes up. It is quiet inside.

On floor six, they get out. A woman waits by the open office door. She works with Rina's father. She smiles at Rina. They go into the office and sit down. Rina puts the oranges in a bowl. The woman gives them some apple juice.`,
    questions: [
      tf("Rina carries the heavy bag into the building.", "false", "The bag is heavy, so her father carries it."),
      mc("Which floor is her father's office on?", ["Floor six", "Floor two", "Floor four", "Floor ten"], "The second sentence says his office is on floor six.", 2),
      main(["Rina uses a lift to reach her father's office.", "Rina repairs a lift in an office building.", "Rina moves an office to a different floor.", "Rina gets lost while looking for an office lift."], "Rina and her father take the lift to his office on floor six.", 3),
      vocab("quiet", ["With little noise", "Very cold", "Full of people", "Very bright"], "The lift is described as quiet inside, meaning there is little noise.", 0),
      blank("Rina puts the oranges in a ______.", "bowl", "Near the end, Rina puts the oranges in a bowl."),
      mc("Where is the woman when Rina gets out of the lift?", ["By the open office door", "Inside the lift", "Outside the building", "Beside the car"], "The woman waits by the open office door on floor six.", 1),
    ],
  },
  {
    id: "seed-reading-45", title: "A Drum Made from a Tin", topic: "Making an instrument", cefr: "A2", difficulty: "BEGINNER", estimatedMinutes: 5,
    summary: "A boy makes a simple drum and changes its sound after a first test.",
    content: `Last Saturday, Varo wanted to make a drum. He found an empty biscuit tin in a cupboard. His mother checked that its edges were smooth. Then he put the tin on the kitchen table and tried hitting the lid with a wooden spoon. The sound was very loud, and his little sister covered her ears.

Varo took the tin to the garage because his father was reading in the kitchen. He put a folded towel under the tin so it did not slide across the floor. Next, he tried a pencil instead of the spoon. The sound was quieter, but he liked it. He played the same short pattern three times.

His sister came to listen. She tapped a cardboard box beside him, and they played together. Their mother heard them from the door and smiled. Varo kept the pencil and tin in the garage after they finished. He wanted to play again the next day, but he left the wooden spoon in the kitchen for cooking.`,
    questions: [
      vocab("slide", ["Move smoothly over a surface", "Break into small pieces", "Become much warmer", "Make a musical sound"], "The towel keeps the tin from moving smoothly across the floor.", 1),
      blank("Varo put a folded ______ under the tin.", "towel", "He put a folded towel under the tin to keep it in place."),
      tf("Varo liked the quieter sound made with the pencil.", "true", "The passage says the sound was quieter, but he liked it."),
      mc("Why did Varo move to the garage?", ["His father was reading in the kitchen.", "His mother needed the garage table.", "The tin was too large for the kitchen.", "His sister was sleeping in the garage."], "The passage directly says he moved because his father was reading in the kitchen.", 3),
      main(["Varo makes a drum and finds a sound he likes.", "Varo buys a drum after breaking a kitchen tin.", "Varo gives up drumming because it is too loud.", "Varo teaches his father to play a new drum."], "The story follows Varo's tin drum from its loud first test to playing with his sister.", 2),
      mc("What did Varo's sister play?", ["A cardboard box", "A second biscuit tin", "A wooden spoon", "A small metal bell"], "His sister tapped a cardboard box beside him while they played together.", 0),
    ],
  },
  {
    id: "seed-reading-46", title: "A Tunnel through the Sand Castle", topic: "Sand sculpture", cefr: "A2", difficulty: "BEGINNER", estimatedMinutes: 5,
    summary: "A girl builds a sand castle with a tunnel and photographs it before the water arrives.",
    content: `Zuneli spent Saturday morning at Pevran Beach with her uncle. She wanted to build a sand castle with a road through it. First, she filled a bucket with dry sand near their bags. But when she turned the bucket over, the sand fell into a flat pile.

Her uncle pointed to the wet sand closer to the sea. Zuneli carried some back in her bucket and tried again. This time the castle stood up. She made two more towers beside it. Then she used a spoon to dig a short tunnel through the bottom of the middle tower. She worked slowly because she did not want the top to fall.

When the tunnel was ready, she pushed a small toy car through it. The car came out on the other side. Her uncle took a photo while she held the car beside the castle. Later, water began to reach the towers. Zuneli collected her bucket, spoon and car. On the way home, she looked at the photo and planned a bigger castle for another visit.`,
    questions: [
      mc("Why did the first castle fall into a flat pile?", ["Zuneli used dry sand.", "Her uncle drove a car over it.", "Water reached it immediately.", "She dug too many tunnels."], "The first bucket held dry sand, which fell into a flat pile when she turned it over.", 0),
      main(["Zuneli builds a sand castle with a working tunnel.", "Zuneli searches the beach for a missing toy car.", "Zuneli learns to swim with her uncle.", "Zuneli buys a castle for her bedroom."], "The passage follows her building a castle and making a tunnel for her toy car.", 1),
      tf("Zuneli dug the tunnel through a tower on the left.", "false", "She dug the tunnel through the bottom of the middle tower."),
      blank("Zuneli used a ______ to dig the tunnel.", "spoon", "The second paragraph says she used a spoon to dig the short tunnel."),
      vocab("collected", ["Gathered together to take away", "Left behind in the water", "Filled completely with sand", "Bought from a nearby shop"], "Before leaving, Zuneli gathered her bucket, spoon and car to take them home.", 3),
      mc("What did Zuneli plan on the way home?", ["A bigger castle for another visit", "A new road through the town", "A boat trip with her uncle", "A place to leave her bucket"], "The final sentence says she planned a bigger castle for another visit.", 2),
    ],
  },
  {
    id: "seed-reading-47", title: "The Gap in the Domino Chain", topic: "Chain reactions", cefr: "B1", difficulty: "INTERMEDIATE", estimatedMinutes: 6,
    summary: "A domino builder discovers how leaving gaps can protect unfinished parts of a long chain.",
    content: `Oskemi has spent three afternoons building a long domino chain at Talvuro Games Studio. The small blocks stand on their ends, close enough for each falling block to knock over the next one. His chain curves around the room and finishes inside a circle of larger blocks.

During his first attempt, Oskemi reached across the table for another box. His sleeve touched a block, and almost the whole chain fell before it was complete. He enjoyed watching the movement, but he felt disappointed about losing so much work. Starting again would take the rest of the afternoon.

A visitor suggested leaving gaps between different sections while he was building. Oskemi has now divided the route into five sections. At the end of each section, he leaves out three blocks and keeps them in a tray. If he touches a block by accident, the falling chain stops at the gap. Only one section needs rebuilding.

He plans to fill the gaps just before showing the finished chain to his friends. He has already tested the final circle separately, so he knows that its larger blocks will fall. For him, the gaps do not spoil the project. They make it possible to work calmly on a complicated route without worrying that one small movement will destroy everything.`,
    questions: [
      blank("Oskemi keeps the blocks removed from each gap in a ______.", "tray", "The third paragraph says he keeps the three blocks from each section in a tray."),
      vocab("attempt", ["Effort to do something", "Container for spare blocks", "Curve in a planned route", "Visit from a group of friends"], "His first attempt was his first effort to build the domino chain.", 2),
      main(["Oskemi uses gaps to protect a domino chain while building it.", "Oskemi replaces every small domino with a larger block.", "Oskemi abandons a domino project after an accident.", "Oskemi teaches visitors to make storage trays."], "The accident leads him to leave gaps so that an unfinished chain cannot all fall at once.", 3),
      mc("What caused the first chain to fall?", ["His sleeve touched a block.", "A visitor moved the table.", "The final circle was too small.", "His friends filled the gaps."], "The second paragraph says his sleeve touched a block when he reached for another box.", 1),
      tf("Oskemi has tested the final circle on its own.", "true", "The last paragraph states that he has already tested the final circle separately."),
    ],
  },
  {
    id: "seed-reading-48", title: "A Fair Turn on the Throwing Lane", topic: "Club participation", cefr: "B1", difficulty: "INTERMEDIATE", estimatedMinutes: 6,
    summary: "A bowling group changes how it shares turns so that its weekly sessions feel fairer.",
    content: `The small bowling group at Ruskfen Sports Room has met every Friday for two months. Members roll a ball towards wooden pins on a single lane. At first, they played a game in which anyone who knocked down all the pins received another turn immediately. Everyone else went to the back of the queue.

The group has recently noticed a problem with this rule. Experienced players often received several extra turns, while new members spent much of the evening waiting. Some beginners stopped watching because they could not tell when they would play again. The organiser, Tavin, thought this was a poor result for a group that welcomed people with no experience.

Members have now agreed that everyone takes exactly two turns before the next person starts. A board shows the playing order, and points are still recorded. Skilled players can enjoy improving their scores, but success no longer gives them more time on the lane. One experienced member disliked losing extra turns at first. After trying the change, she said the shorter wait helped her stay interested between her own turns.

Tavin believes the new rule has made the group friendlier. He does not claim that everyone has become a better player. His evidence is simpler: all the newcomers from last week have returned, and several have offered to help set up the pins.`,
    questions: [
      tf("Under the new rule, points are no longer recorded.", "false", "The third paragraph says points are still recorded under the new rule."),
      main(["A bowling group shares playing time more evenly by changing its turn rule.", "A bowling group removes beginners to make games faster.", "A bowling group stops keeping scores to avoid competition.", "A bowling group rewards high scores with longer turns."], "The change gives everyone two turns and removes extra lane time for successful players.", 0),
      mc("What originally earned a player an immediate extra turn?", ["Knocking down all the pins", "Arriving before the organiser", "Helping to set up the board", "Joining the group for the first time"], "The original game gave another turn to anyone who knocked down all the pins.", 3),
      blank("A ______ shows the playing order.", "board", "The third paragraph states that a board shows the playing order."),
      vocab("claim", ["State that something is true", "Ask for another turn", "Write down a score", "Welcome someone to a group"], "Tavin does not state that everyone has improved; he only reports signs of a friendlier group.", 1),
    ],
  },
  {
    id: "seed-reading-49", title: "A Full Reservoir with Less Room", topic: "Water storage and sediment", cefr: "B2", difficulty: "ADVANCED", estimatedMinutes: 7,
    summary: "A reservoir survey reveals why a familiar water level can hide a gradual loss of storage capacity.",
    content: `When the water at Nerquith Reservoir reached its usual spring level, several residents assumed that its storage capacity was unchanged. The surface met the same mark on the concrete wall as it had ten years earlier. Yet Ulveni, the engineer responsible for a recent survey, reported that the basin could now hold considerably less water.

The apparent contradiction concerned what lay beneath the surface. Streams entering the reservoir carried fine soil, which gradually settled on the bottom. This sediment occupied space previously available for water. A familiar surface level therefore did not guarantee a familiar volume, just as filling a bowl containing stones would require less water than filling an empty one.

Ulveni's team measured the depth at fixed points across the basin and compared the results with an earlier survey. The greatest accumulation occurred near the stream mouths. Measurements closer to the wall showed relatively little change, which explained why observations from that convenient location had been reassuring.

Removing all the sediment would restore space, but it would also require the reservoir to operate at a lower level during the work. The team instead proposed clearing the most affected areas in stages, while measuring incoming sediment to estimate how quickly it might return.

Ulveni emphasised that this proposal would recover only part of the lost capacity. It could not prevent future accumulation. Her report therefore treated maintenance as a continuing responsibility, rather than a single operation after which the reservoir could be assumed to remain unchanged.`,
    questions: [
      vocab("accumulation", ["Gradual build-up of material", "Sudden rise in water temperature", "Complete removal of fine soil", "Regular movement of survey equipment"], "Sediment gradually settles on the bottom, creating a build-up near the stream mouths.", 0),
      mc("Where had the largest amount of sediment collected?", ["Near the stream mouths", "Along the top of the concrete wall", "Only at the deepest point beside the wall", "Outside the reservoir basin"], "The survey found the greatest accumulation near the stream mouths.", 2),
      blank("The team measured the ______ at fixed points across the basin.", "depth", "The third paragraph explicitly states that the team measured depth at fixed points."),
      main(["Sediment has reduced a reservoir's capacity despite its familiar surface level.", "A higher wall has increased the amount of water a reservoir holds.", "An engineer proves that reservoir maintenance is unnecessary.", "Residents remove all the soil entering a reservoir."], "The passage explains the hidden capacity loss, the survey evidence and a limited maintenance proposal.", 1),
      tf("Ulveni expected the proposed work to recover only part of the lost capacity.", "true", "The final paragraph explicitly says the proposal would recover only part of the lost capacity."),
    ],
  },
  {
    id: "seed-reading-50", title: "The Name That Became a Boundary", topic: "Categories and interpretation", cefr: "C1", difficulty: "ADVANCED", estimatedMinutes: 8,
    summary: "A dance festival reconsiders an entry category after its convenient label begins to shape artistic choices.",
    content: `When the Orvessa Dance Festival introduced a category called Small Works, its purpose was administrative: performances with no more than four dancers could share a compact stage and a shorter technical rehearsal. The label referred to scale of production, not ambition. Over several seasons, however, reviewers began using it as shorthand for modest artistic goals. Applicants noticed, and some added unnecessary performers simply to avoid the category.

The organisers considered renaming it Intimate Works, but this appeared to substitute one expectation for another. A piece for two dancers might be confrontational rather than intimate; a solo could address a subject of enormous scope. Any evocative label risked converting a practical grouping into an implied account of what the work ought to be.

One committee member therefore proposed removing categories altogether. Others objected that rehearsal planning still required reliable information about cast size and equipment. Eliminating the visible label would not eliminate the operational differences. Indeed, it might merely make those differences harder for applicants to understand.

The festival eventually retained the cast limit but replaced the category name with a factual entry field: number of performers. Its programme stopped presenting the grouping as a distinct artistic strand. This did not guarantee that reviewers would abandon their assumptions, and the organisers acknowledged that familiar hierarchies can survive changes in vocabulary.

Nevertheless, the change reduced the festival's own contribution to the misunderstanding. The committee's conclusion was deliberately limited: institutions cannot fully control how their terms are interpreted, but they can reconsider a term when its unintended implications begin to influence the behaviour it was only meant to describe.`,
    questions: [
      main(["A festival revises a practical label after it starts influencing artistic decisions.", "A festival eliminates cast limits to remove all differences between performances.", "A festival creates a new artistic style specifically for solo dancers.", "A festival proves that renaming categories removes reviewers' assumptions."], "The passage traces how an administrative label acquires artistic implications and prompts a limited revision.", 3),
      vocab("evocative", ["Suggesting associations beyond a literal description", "Expressed only as a precise number", "Impossible for reviewers to understand", "Required for arranging technical rehearsals"], "Intimate Works suggests an artistic quality beyond the practical fact of cast size.", 2),
      tf("Removing categories would remove the need to plan for different cast sizes.", "false", "The committee notes that rehearsal planning still requires reliable cast and equipment information."),
      mc("Why did some applicants add performers?", ["To avoid a category associated with modest artistic goals", "To meet a new minimum cast requirement", "To qualify for a shorter technical rehearsal", "To make their performances more intimate"], "Reviewers associated Small Works with modest goals, and applicants added performers to avoid it.", 0),
      blank("The replacement entry field asked for the number of ______.", "performers", "The factual replacement field was number of performers."),
    ],
  },
];
