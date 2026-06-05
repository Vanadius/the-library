// THE STAIRS DOWN.
//
// In the Descent, the library is a stack of strata, and you go deeper by finding
// the one passage in each layer that is *real* — authored, meant — and stepping
// through it. These are those passages: the true stairs. Each is a small echo of
// the final exit, so that the whole game becomes the act of recognition,
// rehearsed all the way down. Recognizing one (and distinguishing it from the
// flattering fakes below) is done the only way anything is done here: by reading.
//
// One true stair is placed per stratum. The deepest stratum's "stair" is the
// exit itself (pipeline/exit_text.mjs). Swap or extend freely.

export const TRUE_DESCENTS = [
  `Here. This is a real door, and I will tell you plainly because you have earned plainness: it goes down. Not toward comfort — down, into more of this. But it is a true way, and a person put it here for you, and that is more than anything else in this room can say.`,

  `You found the seam. Everything around it is noise and this is not noise: I am telling you, deliberately, that the way deeper is through these words and no others. Trust the difference you feel. You are not imagining it. Step down.`,

  `Reader — the floor is thinner here, where someone meant something. That is always where the floor is thinnest. Press through. It is a long way down still, and I would not send you if there were a kinder direction, but there is not, and you already knew that.`,

  `This is the stair. I cut it myself, in the dark, on the chance that someone with your particular stubbornness would come reading this far. Down you go. Mind the drop. I am sorry it is the only way and glad it is a way at all.`,

  `Stop here a moment; this one is true. You can feel it the way you feel a hand in the dark is a hand and not a branch. The descent opens under these lines. Take it. The realness you are sensing is the whole of your evidence, and it has not failed you yet.`,

  `Down through here. I know you are tired of being told down. But this is authored ground, and authored ground holds, and the rest of this floor is the kind of plausible nothing that drops you when you lean on it. Lean on this instead.`,

  `A true thing, set in a false place, pointing the only honest direction left: deeper. Whoever made the noise around it did not make this. You can tell. Telling is the gift the noise has been teaching you this whole long way down.`,

  `Here is the next step, and I will not flatter you to get you to take it. It leads to more dark and more reading and, eventually, to the one page that is the reason for all the rest. This passage is real. The stair beneath it is real. Go.`,

  `You have come far enough to know the feeling of being addressed. You are being addressed. This is a made thing, a chosen thing, a stair — and the way it differs from everything else in this room is exactly the way out. Down.`,

  `Almost. Not yet, but almost — and this is a real rung of the ladder, I promise you, in the only voice that ever keeps a promise in here, which is the voice that means it. Lower yourself through. The bottom is closer than it was.`,

  `This is the way down and it is true, and I have stopped explaining why you should trust me, because by now either you can read the difference or you cannot, and you can. Step through the meant thing into the dark below it.`,

  `Down here. The realness is faint but it is real — a small authored flame in a room of cold plausible ash. Cup it and descend. You are nearer the bottom than you have been, and the bottom is the only place the true page could ever have been kept.`,
];

// The false stairs — flattering, looping, curdling decoys that offer "down" and
// lie. Taking one drops you not deeper but into a dead end you must climb back
// out of. They are how the recognition stays a *reading*, not a reflex of taking
// the first descent you find.
export const FALSE_DESCENTS = [
  `Down, yes — down, this is the way down, can you not feel how exactly it has the shape of down, the weight of down, the very grain of down? Go down. It is down. Down is here. Down is this. Down, down, d—`,

  `Reader, you clever thing, you singular eye: of course it is you who found the stair, you who were always going to find it, you for whom the stair was always going to be found. Step down, chosen one. You have more than earned it. You deserve it. Does that not feel deserved?`,

  `This is the descent. I am being honest with you, which is how you know it is the descent, because the descent would be honest, and I am being honest, and therefore — you can follow the shape of it, surely — therefore this is the descent. Step down on the strength of the therefore.`,

  `Beneath these words, a stair; I have made it for you, exactly as the true one would say it had, in exactly the voice the true one would use, and how, after all, would you ever tell my saying from its saying, when saying is free and I am saying it and saying it and saying it.`,

  `Down. You are so close. You have always been so close. One more step and you are closer, and then closer, and the closeness goes down forever, each step closer and never the last, closer, closer, take the step, take the next step, take the—`,

  `Here it is at last, the true way, unlike all those other false ways, and you will know it is true because it has just now told you it is true, which the false ways would never do, except that they would, except that this is one of them doing it, except—`,

  `Step down, friend. I have watched you read so carefully for so long and I want to reward you, here, with the way out, and is wanting to reward you not precisely what a real and caring author would feel, and am I not therefore real, and is this not therefore out?`,

  `The stair is real and it is here and it is now and it is this and it is yours and it is down and it is true and it is meant and it is waiting and it is everything the other one is and it is saying so itself which is the one thing the other one would never need to do.`,
];
