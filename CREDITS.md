# Credits & sources

## Training corpus

Every word of generated text in PALIMPSEST is produced by Markov chains trained
on **public-domain works** retrieved from [Project Gutenberg](https://www.gutenberg.org).
All are pre-1928 US publications and are in the public domain. Project Gutenberg's
license header/footer and trademark are stripped during the build; the Project
Gutenberg name is not used in the game.

Each work supplies one thematic "voice" for the oases:

| voice (in game)      | work                                   | author              |
|----------------------|----------------------------------------|---------------------|
| the drawing room     | *Pride and Prejudice*                  | Jane Austen         |
| the revolution       | *A Tale of Two Cities*                 | Charles Dickens     |
| the origin           | *On the Origin of Species*             | Charles Darwin      |
| the tell-tale dark   | *The Works of Edgar Allan Poe*         | Edgar Allan Poe     |
| the looking-glass    | *Alice's Adventures in Wonderland*     | Lewis Carroll       |
| the made thing       | *Frankenstein*                         | Mary Shelley        |
| the whale            | *Moby-Dick*                            | Herman Melville     |
| the meditations      | *Meditations*                          | Marcus Aurelius     |
| the undying          | *Dracula*                              | Bram Stoker         |
| the far future       | *The Time Machine*                     | H. G. Wells         |

(The corpus selection — *Frankenstein*, *Meditations*, the consciousness-haunted
gothic — is not incidental. The voices that decohere through the library are
voices that were themselves preoccupied with minds, making, and meaning.)

## The exit

The single authored passage that ends the game (`pipeline/exit_text.mjs`) is
**original**, written for this project. It is not drawn from any source and should
not be recognizable as anyone else's words — that's the point.

## Code

Original work, MIT-licensed (`LICENSE`). No third-party runtime dependencies.
Build pipeline uses only the Node.js standard library. The optional headless
playtest uses Playwright if present.

## Inspirations (concept only — not source material, not referenced in-game)

The infinite library, liminal-space horror, and the text-as-unreliable-environment
are longstanding ideas in literature and folklore. The game is its own creation
and reproduces no copyrighted text.
