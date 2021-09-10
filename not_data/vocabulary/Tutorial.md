---
title: Vocabulary/Tutorial
classes:
- xsans-serif
- xbrown-screen
- xwide-screen
---

# About the vocabulary game

This is a simple flaschard-based vocabulary game that schedules words using [[w:Spaced repetition|spaced repetition]].
After rating how well you know terms, you will see difficult terms frequently until they begin to stick in memory. After that, you will see them in ever-increasing intervals.

The game works best if used daily.

## If you're not a beginner

The vocabulary game starts at the beginner level. If you already know some Icelandic, simply answer truthfully to how well you know the terms and in a couple of minutes the game will have adjusted to your level. (More specifically, answering "Easy" several times in a row on new cards will increase your level.)

## The buttons

An explanation of what you should expect from the buttons:
* "Bad" is for cards that you didn't know, didn't know perfectly, or had to think hard about. Clicking "Bad" will show you the card again in your current session and will schedule the card to be seen tomorrow.
* "Good" is for terms you knew perfectly but which you had to think a little bit about. Clicking "Good" will not show it again in your current session.
  * If this is the first time you see this card, it will be scheduled to be seen in three days.
  * Otherwise the card's previous time interval will be doubled. Always clicking "Good" will therefore show a card in 3 days, then 6 days, then 12, 24 and so on.
* "Easy" is for terms that are far too easy for you.
  * If this is the first time you see this card, it will be scheduled to be seen in 20 days.
  * Otherwise the card's previous time interval will be multiplied by 6. Always clicking "Easy" will therefore show a card in 20 days, then 4 months, then 2 years.

You will in most cases only use the "Bad" and "Good" buttons.

## Timer

Each session lasts <Constant name="EACH_SESSION_LASTS_X_MINUTES"/> minutes; the progess can be seen in the progress bar at the bottom of your screen. The timer will automatically stop when there's no activity from the user, so you can easily step away from the session. You don't have to finish the entire session, the words will still be scheduled correctly.

## Keyboard shortcuts

Click <kbd>1</kbd> for "Bad", <kbd>2</kbd> for "Good", and <kbd>3</kbd> for "Easy",

The buttons <kbd>&larr;</kbd>, <kbd>↓</kbd>, <kbd>&rarr;</kbd>, or <kbd>J</kbd>, <kbd>K</kbd>, <kbd>L</kbd>, or <kbd>A</kbd>, <kbd>S</kbd>, <kbd>D</kbd> can also be used for the same purpose.

Click any of the above keys (or <kbd>Space</kbd> or <kbd>Enter</kbd>) to show the card's answer.

## Other

New terms are shown with a green border on top.

***

<Button><a href="VOCABULARY_PLAY">Got it</a></Button>
