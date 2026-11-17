import type { ListeningBankLesson, ReadingBankLesson } from "./lesson-bank-data";

export const moreListeningLessons: ListeningBankLesson[] = [
  {
    id: "seed-listening-7",
    title: "Your Pottery Class Reminder",
    topic: "Leisure",
    difficulty: "BEGINNER",
    transcript: `Hello, this is a message from the pottery room in Mossbell Hall. You booked a place in our bowl class this Saturday. The class starts at ten in the morning and finishes at noon. Please arrive ten minutes early so we can give you an apron. Our teacher provides the clay and all the tools. Bring an old towel to dry your hands. You do not need to bring any paint. We will paint the bowls at a different class next month. Please use the side door because workers are repairing the front steps. The side door is beside the apple tree. Inside the room, put your bags on the shelf near the window. The table by the sink is for washing tools. The long table in the centre is where you will make your bowl. Your bowl needs time to dry after the class. We will keep it here, so please leave it on your table. We look forward to seeing you on Saturday.`,
    questions: [
      { type: "MULTIPLE_CHOICE", prompt: "When does the class finish?", options: ["At ten in the morning", "At noon", "At two in the afternoon", "At ten minutes past ten"], answer: "At noon", explanation: "The message says the class starts at ten and finishes at noon." },
      { type: "TRUE_FALSE", prompt: "Participants will paint their bowls this Saturday.", answer: "false", explanation: "The speaker says painting will happen at a different class next month." },
      { type: "FILL_BLANK", prompt: "Participants should bring an old ______ to dry their hands.", answer: "towel", explanation: "The message asks participants to bring an old towel to dry their hands." },
      { type: "MULTIPLE_CHOICE", prompt: "Why should participants use the side door?", options: ["The front steps are being repaired.", "The teacher waits in the garden.", "The main hall is holding a concert.", "The front door has a broken lock."], answer: "The front steps are being repaired.", explanation: "The speaker asks people to use the side door because workers are repairing the front steps." },
      { type: "MATCHING", prompt: "Match each place with its use in the pottery room.", pairs: [{ left: "Shelf near the window", right: "Storing bags" }, { left: "Table by the sink", right: "Washing tools" }, { left: "Long table in the centre", right: "Making bowls" }], explanation: "Bags go on the window shelf, tools are washed by the sink, and bowls are made at the centre table." },
    ],
  },
  {
    id: "seed-listening-8",
    title: "An Afternoon at the Puppet Theatre",
    topic: "Entertainment",
    difficulty: "BEGINNER",
    transcript: `Welcome to the little puppet theatre in Fernpocket. Our afternoon show begins in twenty minutes. Today's story is about a fox who wants to learn to sing. The show lasts forty minutes and has no break. Please keep your ticket with you until you leave. You can take photos in the entrance hall, but please put your camera away during the show. Bright lights make it hard for the person moving the puppets to see. There is a coat stand beside the ticket desk. You can leave your coats there before entering the theatre. The toilets are at the end of the short corridor on your left. After the show, our puppet maker will bring the fox puppet into the entrance hall. You can look at its wooden head and soft tail. Please ask before you touch it. The puppet maker will also explain how its mouth opens. This short talk is free for everyone with a show ticket. Thank you, and enjoy the story.`,
    questions: [
      { type: "MULTIPLE_CHOICE", prompt: "What does the fox in the story want to learn?", options: ["To make clothes", "To swim", "To sing", "To build a house"], answer: "To sing", explanation: "The announcement describes a fox who wants to learn to sing." },
      { type: "TRUE_FALSE", prompt: "The show includes a break.", answer: "false", explanation: "The speaker says the show lasts forty minutes and has no break." },
      { type: "FILL_BLANK", prompt: "Visitors can leave coats on a stand beside the ______.", answer: "ticket desk", explanation: "The announcement places the coat stand beside the ticket desk." },
      { type: "MULTIPLE_CHOICE", prompt: "Why are cameras put away during the show?", options: ["Their bright lights make the puppet operator's work harder.", "The theatre wants to keep the fox's appearance secret.", "The puppet maker needs the cameras to record the show.", "Their sounds stop the audience from hearing the story."], answer: "Their bright lights make the puppet operator's work harder.", explanation: "Bright lights make it hard for the person moving the puppets to see." },
      { type: "MULTIPLE_CHOICE", prompt: "Where will the puppet maker give the free talk?", options: ["On the stage", "In the short corridor", "Behind the stage", "In the entrance hall"], answer: "In the entrance hall", explanation: "After the show, the puppet maker brings the fox into the entrance hall and explains its mouth." },
    ],
  },
  {
    id: "seed-listening-9",
    title: "Preparing for the Stream Clean-Up",
    topic: "Volunteering",
    difficulty: "INTERMEDIATE",
    transcript: `Hello, volunteers. I am leaving this message with the final arrangements for Sunday's clean-up beside the stream in Dewmere. We will meet at the footbridge at half past nine, rather than at the car park as originally planned. The car park is being used for a local event. Please bring drinking water and wear strong shoes because the path can be muddy. We will provide gloves and collection bags. Before we begin, our coordinator will explain which areas each group should cover. The green group will collect litter along the upper path. The blue group will record the types of rubbish at the picnic area. The orange group will carry filled bags to the collection point beside the gate. No group will enter the water. If you find broken glass, leave it where it is and tell the coordinator. We will stop at noon and have sandwiches under the shelter. If heavy rain forces us to cancel, I will send a message by eight on Sunday morning. Otherwise, please assume the event is going ahead.`,
    questions: [
      { type: "MULTIPLE_CHOICE", prompt: "Why has the meeting place changed?", options: ["The footbridge is closed.", "The car park is being used for an event.", "The picnic area has no shelter.", "The gate is too far from the stream."], answer: "The car park is being used for an event.", explanation: "The speaker replaces the car park meeting point because a local event is using it." },
      { type: "TRUE_FALSE", prompt: "Some volunteers will work in the stream itself.", answer: "false", explanation: "The speaker explicitly says that no group will enter the water." },
      { type: "FILL_BLANK", prompt: "Volunteers will have sandwiches under the ______.", answer: "shelter", explanation: "The group will stop at noon and have sandwiches under the shelter." },
      { type: "MATCHING", prompt: "Match each group with its task.", pairs: [{ left: "Green group", right: "Collect litter along the upper path" }, { left: "Blue group", right: "Record rubbish types at the picnic area" }, { left: "Orange group", right: "Carry filled bags to the gate" }], explanation: "The message assigns upper-path collection to green, recording to blue, and carrying filled bags to orange." },
      { type: "MULTIPLE_CHOICE", prompt: "What should volunteers do if they find broken glass?", options: ["Put it in a collection bag themselves", "Carry it to the picnic area", "Leave it and tell the coordinator", "Cover it with their gloves"], answer: "Leave it and tell the coordinator", explanation: "The message says to leave broken glass where it is and tell the coordinator." },
    ],
  },
  {
    id: "seed-listening-10",
    title: "The Clockmaker's Room",
    topic: "Museum visit",
    difficulty: "INTERMEDIATE",
    transcript: `You are now entering the clockmaker's room at Bellfern Museum. This room shows the workshop of a craft worker named Eren Vale, who made clocks for the town hall. The large wooden clock beside the door is the oldest object here. It still works, although museum staff wind it rather than allowing visitors to touch it. On the central bench, you can see small tools used to shape metal parts. The drawings on the far wall show designs that were never completed. They help us understand how Eren changed his ideas before building anything. Notice the empty space below the window. A second workbench once stood there, but it was removed when the museum widened the visitor path. The cabinet beside that space contains letters from customers asking for repairs. These letters tell us more about daily workshop life than the finished clocks alone. You may take photographs without flash in this room. When you are ready to continue, follow the wooden arrows to the next gallery, which explores local musical instruments.`,
    questions: [
      { type: "MULTIPLE_CHOICE", prompt: "Who winds the large wooden clock now?", options: ["Museum staff", "Visiting children", "Local customers", "Music teachers"], answer: "Museum staff", explanation: "The guide says museum staff wind the clock and visitors cannot touch it." },
      { type: "TRUE_FALSE", prompt: "Every design on the far wall became a completed clock.", answer: "false", explanation: "The drawings on the far wall show designs that were never completed." },
      { type: "FILL_BLANK", prompt: "The cabinet contains letters from customers asking for ______.", answer: "repairs", explanation: "The guide describes letters from customers asking for repairs." },
      { type: "MATCHING", prompt: "Match each location with what it displays.", pairs: [{ left: "Beside the door", right: "The oldest clock" }, { left: "Central bench", right: "Tools for shaping metal" }, { left: "Far wall", right: "Unfinished designs" }], explanation: "The oldest clock is by the door, metalworking tools are on the central bench, and designs are on the far wall." },
      { type: "MULTIPLE_CHOICE", prompt: "Why was the second workbench removed?", options: ["It was sold to a customer.", "It stopped the clock from working.", "It was needed in the instrument gallery.", "The museum widened the visitor path."], answer: "The museum widened the visitor path.", explanation: "The guide explains that the workbench was removed when the visitor path was widened." },
    ],
  },
  {
    id: "seed-listening-11",
    title: "What a Sound Map Leaves Out",
    topic: "Research methods",
    difficulty: "ADVANCED",
    transcript: `Welcome to Field Notes, our short programme about investigating everyday places. Today we consider a sound mapping project in the town of Hushmere. Volunteers recorded one minute of sound at each of twenty street corners. The resulting map seemed to show that the western streets were consistently quieter than the eastern ones. However, the recordings were not made under comparable conditions. The western team worked early on Sunday, while the eastern team recorded during the weekday lunch period. The map therefore combined differences in location with differences in timing. This does not make the recordings worthless, but it limits the conclusions we can draw from them. The project leader has proposed a second round in which every corner is recorded during the same three time periods. Volunteers will also note unusual events, such as nearby construction, rather than treating them as typical background noise. Even this improved design will offer only a sample of the town's changing soundscape. The important distinction is between describing what a recording contains and claiming that it represents a place at all times. A convincing map needs an explanation of how its evidence was collected, as well as clear symbols and attractive colours.`,
    questions: [
      { type: "MULTIPLE_CHOICE", prompt: "What weakened the first comparison between east and west?", options: ["Different numbers of street corners were recorded.", "All recordings were made inside buildings.", "The teams recorded during different time periods.", "The volunteers deleted all construction sounds."], answer: "The teams recorded during different time periods.", explanation: "Western recordings were made early on Sunday, while eastern ones were made during weekday lunch." },
      { type: "TRUE_FALSE", prompt: "The speaker considers the first recordings completely worthless.", answer: "false", explanation: "The speaker explicitly says the limitation does not make the recordings worthless." },
      { type: "FILL_BLANK", prompt: "The improved design will still provide only a ______ of the changing soundscape.", answer: "sample", explanation: "The speaker says even the improved design will offer only a sample." },
      { type: "MULTIPLE_CHOICE", prompt: "What will volunteers do about unusual events in the second round?", options: ["Record a note about them", "Assume they occur every day", "Cancel the whole project", "Move every recording indoors"], answer: "Record a note about them", explanation: "Volunteers will note unusual events such as nearby construction rather than treating them as typical." },
      { type: "MULTIPLE_CHOICE", prompt: "What is the speaker's central point?", options: ["Sound maps should exclude all busy streets.", "A map's claims need to reflect how its evidence was gathered.", "Attractive colours make recording methods unnecessary.", "One recording can represent a street at every time."], answer: "A map's claims need to reflect how its evidence was gathered.", explanation: "The closing sentences distinguish a recording's contents from broad claims and call for explaining evidence collection." },
    ],
  },
  {
    id: "seed-listening-12",
    title: "Who Chooses the Festival Programme?",
    topic: "Culture and participation",
    difficulty: "ADVANCED",
    transcript: `In this week's Culture Window, I want to examine a decision made by the Lanternbrook Festival. Previously, its organisers selected every performance themselves. This year, residents were invited to suggest events, but the organisers retained responsibility for the final programme. Suggestions arrived through three different routes. The online form attracted proposals for evening concerts. Paper cards collected at the swimming pool mainly requested daytime workshops. A discussion at the residents' hall produced ideas for outdoor storytelling. These patterns are interesting, but they should not be mistaken for a complete picture of local preferences. Each route reached a different group, and many people contributed through none of them. The organisers published a short explanation of their choices, including why a popular request for a late concert could not fit the venue's closing time. Some residents remained disappointed, yet they could see how the decision had been reached. Next year, the festival plans to visit places where few suggestions originated, rather than simply increasing publicity through its existing channels. Participation can broaden a cultural programme, but an invitation alone does not guarantee that every voice will be heard.`,
    questions: [
      { type: "MULTIPLE_CHOICE", prompt: "Who had final responsibility for this year's programme?", options: ["The swimming pool staff", "The online voters", "The storytelling performers", "The festival organisers"], answer: "The festival organisers", explanation: "Residents suggested events, but the organisers retained responsibility for the final programme." },
      { type: "TRUE_FALSE", prompt: "The suggestions represented a complete picture of local preferences.", answer: "false", explanation: "The speaker warns against that interpretation because many people contributed through none of the routes." },
      { type: "FILL_BLANK", prompt: "A late concert could not fit the venue's ______.", answer: "closing time", explanation: "The published explanation says the late concert could not fit the venue's closing time." },
      { type: "MATCHING", prompt: "Match each suggestion route with the type of event it produced.", pairs: [{ left: "Online form", right: "Evening concerts" }, { left: "Cards at the swimming pool", right: "Daytime workshops" }, { left: "Residents' hall discussion", right: "Outdoor storytelling" }], explanation: "The speaker links the form to evening concerts, pool cards to daytime workshops, and the hall discussion to outdoor storytelling." },
      { type: "MULTIPLE_CHOICE", prompt: "What change is planned for next year?", options: ["Letting one online vote decide every event", "Visiting places that produced few suggestions", "Rejecting all suggestions for workshops", "Ending consultation with local residents"], answer: "Visiting places that produced few suggestions", explanation: "The festival plans to visit places where few suggestions originated, expanding who is reached." },
    ],
  },
];

export const moreReadingLessons: ReadingBankLesson[] = [
  {
    id: "seed-reading-7",
    title: "A Card for Willow Library",
    topic: "Public services",
    difficulty: "BEGINNER",
    estimatedMinutes: 5,
    summary: "Nela gets a library card and learns how to borrow books.",
    content: `Nela lives in the village of Willow Hollow. Last Tuesday, she visited its library for the first time. She wanted a book about drawing birds. Inside, she saw low shelves, large windows and a desk near the door. A worker called Oren welcomed her.

Nela asked for a library card. Oren gave her a short form. She wrote her name and home address on it. The card was free, and Oren made it while she waited. He explained the rules in simple words. Readers can borrow three books at a time. They can keep them for two weeks. The return date is on a small piece of paper inside each book.

Nela found her drawing book upstairs. She also chose a story about a dog. Before she left, Oren showed her a box outside the front door. People can return books there when the library is closed. Nela put her new card in her bag. She planned to come back with her younger sister the next week.`,
    questions: [
      { type: "MULTIPLE_CHOICE", prompt: "What kind of book did Nela want when she arrived?", options: ["A book about dogs", "A book about drawing birds", "A book about village history", "A book about cooking"], answer: "A book about drawing birds", explanation: "The first paragraph says she wanted a book about drawing birds." },
      { type: "TRUE_FALSE", prompt: "Nela paid for her library card.", answer: "false", explanation: "The passage states that the card was free." },
      { type: "FILL_BLANK", prompt: "Readers can keep their books for two ______.", answer: "weeks", explanation: "Oren explains that readers can keep the books for two weeks." },
      { type: "VOCAB_IN_CONTEXT", prompt: 'In the passage, "return" means:', options: ["Read aloud", "Buy from a shop", "Give back", "Write about"], answer: "Give back", explanation: "The outside box lets people give borrowed books back when the library is closed." },
      { type: "MAIN_IDEA", prompt: "What is the passage mainly about?", options: ["How Nela learns to use her village library", "Why Nela builds new library shelves", "How Nela teaches a library drawing class", "Why Nela stops borrowing library books"], answer: "How Nela learns to use her village library", explanation: "Nela gets a card, learns the borrowing rules and finds out where to return books." },
    ],
  },
  {
    id: "seed-reading-8",
    title: "The Garden Behind the Hall",
    topic: "Community",
    difficulty: "BEGINNER",
    estimatedMinutes: 5,
    summary: "Neighbours turn an empty space into a shared vegetable garden.",
    content: `Behind the meeting hall in Pebblewick, there was an empty piece of land. Old boxes covered the ground. Last spring, a neighbour named Tavi had an idea. She asked people in her street to help make a garden there. Twelve neighbours came on the first Saturday.

First, they moved the boxes and cleaned the ground. Then they made small beds for vegetables. Tavi brought bean seeds, and her friend Ivo brought carrots. The children painted a wooden sign for the gate. Everyone worked slowly because the afternoon was hot. They stopped for water under a large tree.

Now the neighbours share the work. Tavi waters the plants on Mondays. Ivo comes on Thursdays to pull out weeds. Each Sunday, the group picks vegetables together and shares them equally. They do not sell anything. A bench stands beside the gate, so people can sit and talk after work. Tavi likes the fresh food, but she likes knowing her neighbours even more. Before the garden, she only knew two people in her street.`,
    questions: [
      { type: "MULTIPLE_CHOICE", prompt: "What did the group do first?", options: ["Picked carrots", "Painted the bench", "Sold beans", "Moved boxes and cleaned the ground"], answer: "Moved boxes and cleaned the ground", explanation: "The second paragraph begins with moving the boxes and cleaning the ground." },
      { type: "TRUE_FALSE", prompt: "The neighbours sell their vegetables.", answer: "false", explanation: "They share the vegetables equally, and the text says they do not sell anything." },
      { type: "FILL_BLANK", prompt: "The children painted a wooden ______ for the gate.", answer: "sign", explanation: "The text says the children painted a wooden sign for the gate." },
      { type: "VOCAB_IN_CONTEXT", prompt: 'In the passage, "equally" means:', options: ["Only to the children", "In the same amounts", "Before the plants grow", "Without speaking"], answer: "In the same amounts", explanation: "The neighbours share what they pick equally, giving each person the same amount." },
      { type: "MAIN_IDEA", prompt: "Which sentence best summarises the passage?", options: ["A garden becomes a shop for local vegetables.", "A garden closes because nobody helps.", "A shared garden brings neighbours together.", "A garden is replaced by a meeting hall."], answer: "A shared garden brings neighbours together.", explanation: "The group grows food together, and Tavi values getting to know her neighbours most." },
    ],
  },
  {
    id: "seed-reading-9",
    title: "Bikes for Short City Trips",
    topic: "Transport",
    difficulty: "INTERMEDIATE",
    estimatedMinutes: 6,
    summary: "A city adjusts its shared bicycle scheme after listening to users.",
    content: `When the city of Brindleford introduced shared bicycles, the plan looked simple. Residents could collect a bicycle from one station and leave it at another. The scheme was intended for short trips within the centre, rather than weekend rides into the countryside. However, its first month revealed an unexpected problem.

Every morning, people rode downhill from the northern neighbourhoods to the offices near the river. By nine, the northern stations were empty, while the riverside stations were full. Some users could not find a bicycle, and others could not find a space to return one. Adding more bicycles alone would not solve both problems.

The transport team therefore changed its approach. A small electric van now moves bicycles back uphill before the morning rush. The team also added return spaces near the offices. After these changes, complaints about empty stations decreased during the following month.

Nevertheless, the team is cautious about declaring success. The trial took place in dry weather, and winter use may be different. It plans to collect information throughout the year before expanding the scheme. For now, the lesson is that a useful transport service needs careful distribution as well as enough equipment.`,
    questions: [
      { type: "MULTIPLE_CHOICE", prompt: "Why were the northern stations empty by nine?", options: ["People rode their bicycles downhill to the offices.", "The stations were closed for winter.", "The van took all the bicycles to a repair shop.", "People rode north from the riverside offices."], answer: "People rode their bicycles downhill to the offices.", explanation: "Morning users travelled from the northern neighbourhoods to offices near the river." },
      { type: "TRUE_FALSE", prompt: "The team plans to collect information throughout the year before expanding.", answer: "true", explanation: "The final paragraph says information will be collected throughout the year before expansion." },
      { type: "FILL_BLANK", prompt: "Before the morning rush, a van moves bicycles back ______.", answer: "uphill", explanation: "The changed approach uses a small electric van to move bicycles back uphill." },
      { type: "VOCAB_IN_CONTEXT", prompt: 'In the passage, "distribution" refers to:', options: ["The colour of the bicycles", "The price of bicycle repairs", "The speed of office workers", "How bicycles are spread across locations"], answer: "How bicycles are spread across locations", explanation: "Empty northern stations and full riverside stations show why the locations of bicycles matter." },
      { type: "MAIN_IDEA", prompt: "What is the main idea?", options: ["Shared bicycles work best when every station is beside a river.", "A shared bicycle scheme needs adjustments based on travel patterns.", "A shared bicycle scheme should serve only weekend tourists.", "Shared bicycles remove the need to study seasonal travel."], answer: "A shared bicycle scheme needs adjustments based on travel patterns.", explanation: "The city responds to uneven morning demand and plans further observation before expanding." },
    ],
  },
  {
    id: "seed-reading-10",
    title: "Returning the Wrong Lamp",
    topic: "Everyday services",
    difficulty: "INTERMEDIATE",
    estimatedMinutes: 6,
    summary: "Sela follows an online shop's return process after receiving the wrong lamp.",
    content: `Sela ordered a yellow desk lamp from a small online shop in Fablemere. When the parcel arrived, she discovered a green lamp inside. The lamp worked, but it was not the colour she had ordered. Instead of sending it back immediately, she opened the shop's help page and read its instructions.

The page asked customers who received the wrong item to send a photograph and their order number. Sela did both that evening. The next morning, a member of staff confirmed the mistake and emailed a return label. The message explained that the shop would arrange collection, so Sela did not need to visit a parcel office.

She put the lamp back in its original box and removed the old address label. A driver collected the parcel on Friday. The shop sent the yellow lamp only after the returned parcel reached its warehouse on Monday. Sela received the replacement on Wednesday.

Although the process took longer than she expected, she found the messages clear. She later suggested adding a colour check before parcels left the warehouse. The shop replied that it would test this idea. Her experience showed how clear instructions can make a mistake easier to resolve, even when the solution is not immediate.`,
    questions: [
      { type: "MULTIPLE_CHOICE", prompt: "What was wrong with the first lamp?", options: ["It did not work.", "It arrived without a box.", "It was green instead of yellow.", "It had no address label."], answer: "It was green instead of yellow.", explanation: "Sela ordered yellow but found a working green lamp in the parcel." },
      { type: "TRUE_FALSE", prompt: "Sela had to take the return parcel to a parcel office.", answer: "false", explanation: "The shop arranged collection, and a driver collected the parcel on Friday." },
      { type: "FILL_BLANK", prompt: "The returned parcel reached the shop's ______ on Monday.", answer: "warehouse", explanation: "The passage states that the parcel reached the warehouse on Monday." },
      { type: "VOCAB_IN_CONTEXT", prompt: 'In the passage, "resolve" means:', options: ["Hide from customers", "Find a solution to", "Repeat deliberately", "Measure the size of"], answer: "Find a solution to", explanation: "Clear instructions help deal with the mistake and get Sela the correct lamp." },
      { type: "MAIN_IDEA", prompt: "Which sentence best summarises the passage?", options: ["A shop refuses to replace a lamp of the wrong colour.", "A customer repairs a broken lamp using online instructions.", "A shop sends a new lamp before a customer reports a mistake.", "Clear communication helps a customer exchange an incorrect lamp."], answer: "Clear communication helps a customer exchange an incorrect lamp.", explanation: "The passage follows the wrong delivery, the clear return instructions and the replacement." },
    ],
  },
  {
    id: "seed-reading-11",
    title: "When a Recycling Label Is Not Enough",
    topic: "Environment",
    difficulty: "ADVANCED",
    estimatedMinutes: 8,
    summary: "A town discovers why collecting plastic is only one part of recycling.",
    content: `In Alderfen, a new label on public bins promised to make plastic recycling straightforward. Residents were invited to deposit clean bottles, while containers made from mixed materials belonged elsewhere. The council expected that clearer labels would reduce confusion. Yet an inspection revealed that many collected bottles still could not be processed.

The difficulty lay beyond the bins. Although residents had separated the bottles correctly, the sorting centre lacked equipment for recognising one dark type of plastic. Those bottles were removed from the recycling stream and sent for disposal. A high collection rate therefore concealed a limitation in the next stage of the system.

In response, the council published two separate figures: the amount collected and the amount actually sent for processing. This distinction disappointed some campaigners, who feared that lower figures would discourage participation. Others argued that transparent reporting was essential. Without it, residents might assume that putting an object in the right bin guaranteed its transformation into a new product.

The council then arranged a limited trial with a neighbouring sorting centre that had different equipment. It did not claim that this solved every recycling problem. Instead, it presented the trial as a way to test one specific obstacle. The case illustrates why environmental progress should be judged across an entire process, rather than at its most visible point.`,
    questions: [
      { type: "MULTIPLE_CHOICE", prompt: "Why were some correctly separated bottles removed?", options: ["Residents had left food inside them.", "The sorting equipment could not recognise their dark plastic.", "The public bins had no labels.", "All bottles were made from mixed materials."], answer: "The sorting equipment could not recognise their dark plastic.", explanation: "The sorting centre lacked equipment for recognising one dark type of plastic." },
      { type: "TRUE_FALSE", prompt: "The council published collection and processing amounts as separate figures.", answer: "true", explanation: "The third paragraph explicitly describes two figures, distinguishing collection from processing." },
      { type: "FILL_BLANK", prompt: "Supporters of the new figures argued that ______ reporting was essential.", answer: "transparent", explanation: "Those supporting the distinction argued that transparent reporting was essential." },
      { type: "VOCAB_IN_CONTEXT", prompt: 'In the passage, "concealed" means:', options: ["Measured accurately", "Permanently removed", "Made less visible", "Publicly explained"], answer: "Made less visible", explanation: "The high collection rate hid the limitation at the sorting stage rather than revealing it." },
      { type: "MAIN_IDEA", prompt: "Which statement best expresses the main idea?", options: ["Recycling success requires examining what happens after collection.", "Recycling success depends entirely on attractive bin labels.", "Recycling figures should combine collection and processing into one total.", "Recycling trials prove that all plastics can already be processed."], answer: "Recycling success requires examining what happens after collection.", explanation: "The final sentence calls for judging the entire process, supported by the sorting problem." },
    ],
  },
  {
    id: "seed-reading-12",
    title: "The Quiet Value of Failed Models",
    topic: "Education and science",
    difficulty: "ADVANCED",
    estimatedMinutes: 8,
    summary: "A school science fair changes its judging criteria to recognise thoughtful investigation.",
    content: `At the annual science fair in Morrowick, polished models had usually attracted the most attention. Last year, however, the organisers introduced a separate award for the clearest explanation of an unsuccessful test. They wanted students to recognise that an unexpected result could provide useful evidence rather than simply signal poor work.

One entry examined paper bridges. Its designers predicted that adding more folds would always increase the weight a bridge could support. Their first models appeared to confirm this, but a heavily folded version collapsed earlier than expected. Instead of hiding the result, the students photographed the collapse and compared the damaged sections. They suggested that narrow folds had made some parts difficult to secure.

The judges did not accept that suggestion as a proven explanation. They praised the students for distinguishing observation from interpretation and proposing another test using stronger connections. The award recognised this reasoning, rather than the strength of the bridge itself.

Some visitors worried that rewarding unsuccessful tests might lower standards. The organisers replied that careful records and honest analysis were demanding standards in their own right. An unexplained failure would not qualify. By making the reasoning visible, the fair encouraged students to treat models as tools for investigation instead of objects that merely needed to look impressive.`,
    questions: [
      { type: "MULTIPLE_CHOICE", prompt: "What unexpected result did the students observe?", options: ["Every folded bridge supported the same weight.", "An unfolded bridge won the design award.", "Stronger connections made every bridge collapse.", "A heavily folded bridge collapsed earlier than expected."], answer: "A heavily folded bridge collapsed earlier than expected.", explanation: "The second paragraph contrasts their prediction with the early collapse of a heavily folded version." },
      { type: "TRUE_FALSE", prompt: "The judges considered the students' explanation of the collapse proven.", answer: "false", explanation: "The text explicitly says the judges did not accept the suggestion as a proven explanation." },
      { type: "FILL_BLANK", prompt: "The proposed next test would use stronger ______.", answer: "connections", explanation: "The judges praised the proposal for another test using stronger connections." },
      { type: "VOCAB_IN_CONTEXT", prompt: 'In the passage, "interpretation" means:', options: ["A possible explanation of observations", "A photograph of a finished model", "The weight placed on a bridge", "An instruction from the visitors"], answer: "A possible explanation of observations", explanation: "The judges distinguish the observed collapse from the students' suggested reason for it." },
      { type: "MAIN_IDEA", prompt: "What is the main idea?", options: ["Science fairs should reward every failed model regardless of its records.", "Science fairs should replace investigation with attractive displays.", "Science fairs can value rigorous reasoning about unsuccessful tests.", "Science fairs can prove explanations without further experiments."], answer: "Science fairs can value rigorous reasoning about unsuccessful tests.", explanation: "The award values careful records, honest analysis and further testing rather than appearance alone." },
    ],
  },
];
