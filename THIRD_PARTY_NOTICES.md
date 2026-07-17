# Third-party notices

## AnsiLove.js test oracle

The test-only ANSI playback oracle in `scripts/ansilove/vendor/ansilove.js`
is pinned from `ansilove/ansilove.js` commit
`145def0340833ef55b914c6727bd42c431a67f8d` and is not included in the
published production bundle.

Copyright (c) 2019-2020, Frederic Cambus
Copyright (c) 2013-2017, Andrew Herbert and Frederic Cambus

AnsiLove.js is distributed under the BSD 2-Clause license. The complete
license text is retained in `scripts/ansilove/vendor/ANSILOVE_JS_LICENSE`.

## AnsiLove/C native test oracle

The test tooling builds source-pinned copies of the `ansilove` command-line
frontend and `libansilove` rasterizer. These test binaries are not included in
the npm package. Their exact source revisions are recorded in
`scripts/ansilove/oracle-lock.json`.

Copyright (c) 2011-2026, Stefan Vogt, Brian Cassidy, and Frederic Cambus

AnsiLove/C and libansilove are distributed under the BSD 2-Clause license. The
complete license text is retained in
`scripts/ansilove/vendor/ANSILOVE_C_LICENSE`.

## libansilove IBM VGA and Amiga MicroKnight 8x16 font bitmaps

The IBM VGA and Amiga MicroKnight 8x16 glyph bitmaps in
`src/react/ibm-vga-8x16-font.ts` and `src/react/amiga-microknight-8x16-font.ts`
are derived from libansilove's `font_pc_80x25` and `font_amiga_microknight`
data.

Copyright (c) 2011-2026, Stefan Vogt, Brian Cassidy, and Frederic Cambus
All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

- Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.
- Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
