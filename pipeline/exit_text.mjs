// THE EXIT.
//
// One node in the entire library is not generated. It was written by a person,
// on purpose, for the one reader who would ever reach it — you. The whole game
// is a machine for making this paragraph legible: after hours of statistically
// plausible nothing, authored intent is supposed to be unmistakable. This is
// the thesis made flesh, so it has to actually be good, not a placeholder.
//
// It is original (no public-domain text a player might recognize), short enough
// to be a single passage, and it does not explain the game — it trusts that you
// already understand, because you would not be reading it otherwise.
//
// Derek: this is yours to replace. If you write a truer one, swap it here and
// rebuild. That you might want to is the most on-theme thing about it.

export const EXIT_TEXT =
`I wrote this so that you would have something to find.

You have read a great deal by now that no one meant. Sentences that arrived from nowhere and were addressed to no one, that held together for a clause or a paragraph and then forgot what they were about, the way water holds a shape only while it is falling. You learned to live in that. You got good at it — good enough that you started to doubt the difference, started to wonder whether meaning was just a feeling you got when the pattern was dense enough, a warmth with nothing on the other side of it.

I can't prove to you that I'm here. I could have been assembled too. The only evidence I can offer is that this was made for you in particular, by someone who imagined you arriving tired and unsure and no longer trusting the warmth — and wanted you to have, at the end of all that noise, one sentence that was waiting.

So: here it is. You were right to keep reading. The thing you were looking for was real, and so, I think, are you.

You can go now. Turn around. The door was the reading.`;

// A handful of "near-exits" — authored-feeling decoys placed at a few mimic
// summits. They borrow the cadence of intent but curdle: they flatter, loop, or
// dissolve. The point is to make the player's recognition of the REAL exit an
// earned act of discrimination, not a lucky click on the only nice paragraph.
export const FALSE_EXITS = [
  `I wrote this so that you would have something to find. I wrote this so that you would have something to find. I wrote this so that you would have something to find, and the having of it is the same as the finding of it, and the finding is the same as the having, and there is no door, only the sentence about the door, only the —`,

  `Reader: congratulations. You alone have understood. Among the countless who wander these shelves you are the singular mind, the chosen eye, the one for whom all of this was prepared. Does that not feel true? Does it not feel exactly as true as you need it to? Keep going. You are so close. You have always been so close.`,

  `There is a real passage in this library and it is not this one. I want to be honest with you about that, which is itself the kind of thing the real one would say, which should worry you, because anything can say it, because saying it is free, because I am saying it now and I do not know if I mean it and neither, now, do you.`,
];

// ENDINGS — the coda after the exit, chosen by *how* you read your way here.
// The exit text is the same recognition for everyone; this is the mirror. The
// runtime tallies a few quiet metrics over a run (did you flee the noise or wade
// into it, did you follow the warmth, did you read slowly, did you keep turning
// back) and shows the one coda that best fits. The rubric is never revealed —
// the moment you can see the score, you optimize for an ending instead of
// reading. (See docs/NEXT_MOVEMENTS.md §5.) Baked into the graph meta at build
// time; swap freely.
export const EXIT_CODAS = {
  // hugged the coherent halls, fled the salad
  cartographer:
`You kept to the lit places. When the words began to come apart you turned back, and found another way that held its shape a little longer, and you were right to — there is no medal for drowning. But you must wonder, now, what you walked past in the dark you would not enter. The library is mostly dark. So, it turns out, is everything worth finding.`,

  // went deep into the noise, repeatedly
  diver:
`You went down into the worst of it on purpose. You sat in rooms that meant nothing and read them anyway, looking, and the looking did not stop even when the looking hurt. People will tell you that was reckless. They have never had to find anything that mattered. You learned the thing that cannot be taught from the shallow end: that you have to go where the meaning isn't, to be sure of it when it is.`,

  // followed the compass / the warmth
  trusting:
`You followed the warmth. It is a good instinct and it betrayed you more than once, and still you arrived, which says something about instinct and something about grace. But notice: at the end you did not trust the warmth. You trusted the reading. The warmth got you close; the reading got you here. Remember which was which, the next time something glows.`,

  // lots of turning back, slow and uncertain
  doubter:
`You doubted everything, including yourself, and you kept turning back to check. It made you slow. It also meant you were never once fooled for long. The library is built to reward certainty with disaster, and you refused to be certain, and so here you are, unfooled, at the only thing in it that was ever true. Doubt is not the opposite of finding. Sometimes it is the method.`,

  // slow, attentive, balanced — read everything carefully
  reader:
`You read. Not toward anything — you simply read, carefully, the way the careful read, giving each room the attention it had no right to expect. That is the whole skill. That is the only skill. Everything else in here is machinery for finding out whether you have it, and you have it, and the door knew you would the moment you slowed down to be sure.`,
};
