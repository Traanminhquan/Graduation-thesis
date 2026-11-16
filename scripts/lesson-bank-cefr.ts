import type { Cefr } from "./lesson-bank-data";

/** CEFR labels for items 1 to 24 of every skill, which predate the per-item `cefr` field. */
export const earlyCefrLabels: Record<string, Cefr> = {
  "seed-reading-1": "A2", // Market routine includes a passive, descriptive vocabulary and gist questions.
  "seed-reading-2": "B1", // Short explanation of memory research with abstract vocabulary and a main claim.
  "seed-reading-3": "A2", // Past-tense luggage narrative with familiar travel vocabulary and explicit answers.
  "seed-reading-4": "B1", // Workplace trial explained through results, reasons and a clear counterargument.
  "seed-reading-5": "B2", // Extended scientific explanation with interacting threats and qualified conclusions.
  "seed-reading-6": "B2", // Environmental and employment trade-offs, passive forms and competing arguments.
  "seed-reading-7": "A2", // 167-word library visit combines past events with practical borrowing rules.
  "seed-reading-8": "A2", // Connected garden narrative with past and present routines and simple motivations.
  "seed-reading-9": "B1", // 196 words linking bicycle distribution, corrective action and trial limitations.
  "seed-reading-10": "B1", // 205-word return procedure with sequencing, reported messages and evaluation.
  "seed-reading-11": "B2", // Distinguishes collection from processing using technical vocabulary and qualified claims.
  "seed-reading-12": "B2", // Separates observation from interpretation and explains standards for scientific reasoning.
  "seed-reading-13": "A2", // 169-word bakery narrative with past events, times and explicit cause and effect.
  "seed-reading-14": "A2", // 175-word school narrative with simple reported intentions and practical reasons.
  "seed-reading-15": "A2", // 184 words about a temporary bus stop, familiar travel language and direct details.
  "seed-reading-16": "A2", // 187-word repair story with past events, concrete materials and simple feelings.
  "seed-reading-17": "B1", // Explains unequal language practice and evaluates a structured practical solution.
  "seed-reading-18": "B1", // Past-perfect assumptions and contrast connect rehearsal access with confidence.
  "seed-reading-19": "B1", // Workplace learning narrative with supervision, error analysis and progress.
  "seed-reading-20": "B1", // Explains why accurate notices fail and how revised directions support decisions.
  "seed-reading-21": "B2", // Survey coverage, sampling gaps and conditional claims require critical interpretation.
  "seed-reading-22": "C1", // Dense account of archival selection bias distinguishes access, typicality and completeness.
  "seed-reading-23": "B2", // Evaluates service metrics while carefully limiting claims about avoided purchases.
  "seed-reading-24": "B2", // Distinguishes understanding from approval through contrasting stakeholder perspectives.

  "seed-listening-1": "A2", // Clinic message combines conditional instructions, appointment vocabulary and matching.
  "seed-listening-2": "B1", // Past-tense trip account includes past perfect, reasons and an idiomatic reaction.
  "seed-listening-3": "A2", // 167-word announcement requires tracking changed times, platforms and a connection.
  "seed-listening-4": "B1", // 209-word orientation combines several services, advice and a weather contingency.
  "seed-listening-5": "B2", // Research lecture explains memory mechanisms, experimental results and limitations.
  "seed-listening-6": "B2", // Podcast contrasts commercial pressures with experience and trust using reported speech.
  "seed-listening-7": "A2", // 165-word class message links preparation, room locations and reasons for instructions.
  "seed-listening-8": "A2", // 165-word theatre welcome includes restrictions, reasons and a later activity.
  "seed-listening-9": "B1", // Changed arrangements, differentiated group duties and cancellation contingencies.
  "seed-listening-10": "B1", // Museum commentary combines historical changes, relative clauses and spatial matching.
  "seed-listening-11": "B2", // Explains confounded comparisons and the limits of sound samples with explicit signposting.
  "seed-listening-12": "B2", // Qualifies representativeness and contrasts participation routes with decision authority.
  "seed-listening-13": "A2", // 173-word rink announcement includes changed access, equipment locations and exceptions.
  "seed-listening-14": "A2", // 169-word club invitation combines a recording schedule with practical instructions.
  "seed-listening-15": "A2", // 174-word learning narrative with ordered past events and simple emotional reasons.
  "seed-listening-16": "A2", // 169-word market guide combines concrete directions, rules and two closing times.
  "seed-listening-17": "B1", // Power-cut report contrasts causes, past arrangements and proposed improvements.
  "seed-listening-18": "B1", // Exchange instructions require negotiated corrections, topic matching and changed access.
  "seed-listening-19": "B1", // Detour update distinguishes changed routes from unchanged times and ticket validity.
  "seed-listening-20": "B1", // Rehearsal introduction explains musical processes, visitor conduct and display functions.
  "seed-listening-21": "B2", // Distinguishes loans from successful use and qualifies evidence from one season.
  "seed-listening-22": "B2", // Survey protocol links counting rules, uncertain identification and visibility bias.
  "seed-listening-23": "C1", // Dense historical commentary reconciles conflicting sources and absence of evidence.
  "seed-listening-24": "B2", // Multi-method trial evaluation includes access trade-offs and limits to generalisation.

  "seed-writing-1": "A2", // 60-100-word email requires a past absence, an apology and a polite request.
  "seed-writing-2": "B1", // 120-180-word review connects experience, atmosphere and a supported recommendation.
  "seed-writing-3": "B2", // 180-250-word opinion essay requires supported reasons and an opposing argument.
  "seed-writing-4": "A2", // 80-120-word story sequences past events and describes feelings.
  "seed-writing-5": "B1", // 150-200-word problem-solution article compares realistic options with clear links.
  "seed-writing-6": "B2", // 220-280-word balanced essay considers employee and employer perspectives.
  "seed-writing-7": "A2", // 60-120-word polite email connects a noise problem, its effects and a request.
  "seed-writing-8": "A2", // 60-120-word lost-key story uses past simple, sequence and feelings.
  "seed-writing-9": "B1", // 120-180-word essay weighs a familiar advantage and disadvantage with an opinion.
  "seed-writing-10": "B1", // 120-180-word report compares two improvements and justifies a recommendation.
  "seed-writing-11": "B2", // 180-260-word argument addresses opposition and conditions that change its conclusion.
  "seed-writing-12": "B2", // 180-260-word proposal balances audience growth, drawbacks and evaluation criteria.
  "seed-writing-13": "A2", // 60-120-word lost-property email combines description, past events and polite questions.
  "seed-writing-14": "A2", // 60-120-word review describes a recent purchase and gives a simple reason.
  "seed-writing-15": "A2", // 60-120-word story contrasts an expectation with events using past simple.
  "seed-writing-16": "A2", // 60-120-word report links a concrete problem, suggestion and explanation.
  "seed-writing-17": "B1", // 120-180-word article explains club roles and their benefits with examples.
  "seed-writing-18": "B1", // 120-180-word complaint narrates a problem and requests a practical remedy.
  "seed-writing-19": "B1", // 120-180-word proposal supports welcoming activities and feedback with reasons.
  "seed-writing-20": "B1", // 120-180-word essay compares break arrangements and a practical difficulty.
  "seed-writing-21": "B2", // 180-260-word report assesses access barriers, alternatives and uncertain outcomes.
  "seed-writing-22": "B2", // 180-260-word proposal uses qualified recommendations and evidence for a trial.
  "seed-writing-23": "C1", // 180-260-word essay synthesises competing fairness claims into a qualified principle.
  "seed-writing-24": "C1", // 180-260-word article examines representation, editorial framing and incomplete perspectives.

  "seed-speaking-1": "A1", // 60 seconds of familiar morning activities and durations in present simple.
  "seed-speaking-2": "B1", // 90 seconds developing travel intentions, reasons and a possible difficulty.
  "seed-speaking-3": "B2", // 120-second policy argument with supported reasons, concession and conclusion.
  "seed-speaking-4": "A1", // 60 seconds describing familiar food, eating habits and simple preferences.
  "seed-speaking-5": "B1", // 90 seconds explaining learning, difficulties and advice with hypothetical plans.
  "seed-speaking-6": "B2", // 120-second organised argument weighs study approaches and contextual exceptions.
  "seed-speaking-7": "A1", // 60 seconds of concrete weekend routines with present simple and time phrases.
  "seed-speaking-8": "A2", // 60-second connected route instructions include landmarks and a shopping purpose.
  "seed-speaking-9": "B1", // 90-second comparison justifies a choice while recognising a disadvantage.
  "seed-speaking-10": "B1", // 90 seconds explaining a festival's social benefits and recommending an activity.
  "seed-speaking-11": "B2", // 120 seconds of conditional argument, counterargument and a qualified compromise.
  "seed-speaking-12": "B2", // 120 seconds balancing public interest and expertise through a shared decision process.
  "seed-speaking-13": "A1", // 60 seconds of concrete room, material, shape and colour descriptions.
  "seed-speaking-14": "A1", // 60 seconds of short packing instructions with everyday objects and order words.
  "seed-speaking-15": "A2", // 60-second comparison of seats uses comparatives and a reasoned preference.
  "seed-speaking-16": "A2", // 60-second past-tense story connects an unexpected event with feelings and outcome.
  "seed-speaking-17": "B1", // 90-second practical solution explains causes, fairness and polite communication.
  "seed-speaking-18": "B1", // 90-second procedure includes conditional handling of a missing ticket.
  "seed-speaking-19": "B1", // 90-second comparison links practical difficulties with a recommendation.
  "seed-speaking-20": "B1", // 90-second narrative connects a technical problem, response and lesson learned.
  "seed-speaking-21": "B2", // 120-second argument qualifies a school requirement with conditions and concessions.
  "seed-speaking-22": "B2", // 120-second conflict resolution needs diplomatic objections and hypothetical compromise.
  "seed-speaking-23": "B2", // 120 seconds of precise design description distinguishes intentions from tested benefits.
  "seed-speaking-24": "B2", // 120-second argument balances motivation, drawbacks and fair assessment criteria.
};
