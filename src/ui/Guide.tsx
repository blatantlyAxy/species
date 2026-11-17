import { useState } from 'react';

// How to play: the short in-game version of GLOSSARY.md. Keep the two in step when a term changes.

const SECTIONS: { id: string; title: string; items: [string, string][] }[] = [
  { id: 'loop', title: 'The loop', items: [
    ['One life at a time', 'You live as one animal from birth until it wins, dies, or grows old. A life is 30 to 40 turns.'],
    ['Dying is progress', 'Every life pays out: account XP, Gene Points for that species, mastery, and codex knowledge. The next life starts with more options.'],
    ['Goals', 'Each species wins differently. Field Mouse: wean two litters. Deer: rise to lead the herd, then bring at least 6 of them to the Sheltered Glen in winter. Wolf: become pack alpha.'],
    ['Your legacy', 'The screen after a life ends. It shows what you earned and what changed.'],
  ] },
  { id: 'turn', title: 'A turn', items: [
    ['Turn', 'Pick one action. The world then moves on: time passes, something may happen, and the next turn begins.'],
    ['Flashcard', 'The card that appears where the buttons are, showing the result of your action. Quiet results fade by themselves. Anything serious waits for a tap or Enter.'],
    ['Turn log', 'Newest first: the turn that just began, the result of your last action, then earlier turns.'],
    ['Keys', 'Number keys pick an action. Enter, Space or Esc dismiss a card.'],
  ] },
  { id: 'meters', title: 'Meters', items: [
    ['Health', 'At 0 you die. Resting heals; so does being well fed.'],
    ['Hunger', 'Rises every turn and falls when you eat. A full Hunger bar means you are starving and losing Health.'],
    ['Energy', 'Spent by moving, fleeing, hunting and foraging. Rest to recover. With too little you cannot bolt or travel.'],
    ['Safety', 'How calm this place is. Predators nearby push it down, and low Safety makes threats more likely.'],
  ] },
  { id: 'stats', title: 'Stats and Gene Points', items: [
    ['The six stats', 'Mobility (flee, chase), Strength (fight, hunt, challenge), Health (hit points, shaking off sickness), Stamina, Intelligence and Senses (hide, warn, lead).'],
    ['Gene Points', 'Earned per species: 2 for every life, 3 more for a win. Spend them before a life to raise stats up to the species cap.'],
    ['Upkeep', 'Every point above the starting value has a price: more Hunger, more Energy use, or a longer childhood. The prep screen shows the exact cost.'],
    ['Refunds', 'Lowering a stat below its starting value gives a Gene Point back, so lopsided builds are possible.'],
    ['Life stages', 'Juvenile, adult, elder. Juveniles are weaker and cannot breed or challenge. Elders slow down.'],
  ] },
  { id: 'threats', title: 'Threats and odds', items: [
    ['Contested roll', 'When you hide, bolt, fight or hunt, your number is compared with the other animal\'s. Even is 50%. Each point of difference moves it 8 points, never below 5% or above 95%.'],
    ['Cover', 'Thick cover helps you hide and bolt. Open ground helps hawks.'],
    ['Odds on buttons', 'From account level 2 the chance is shown on each risky action. Before that the button names the stat it tests.'],
    ['Seasons', 'Eight turns each. Winter cuts food, drains more, and harsh ground (Windy Ridge) costs Health every turn. The Sheltered Glen is safe from cold.'],
  ] },
  { id: 'map', title: 'The map', items: [
    ['Places and paths', 'The world is eight places joined by paths. Travel moves you one path at a time.'],
    ['Minimap', 'Your place is ringed in yellow. Tap a neighbouring place to travel there. Grey dots marked ? are places you have not visited and cannot see yet.'],
    ['Sight tier', 'From 0 to 3. Higher tiers show danger, food and predators further away. It grows with account level, species mastery, high Senses, Keen Nose and a well-filled codex.'],
    ['Pixel scene', 'The picture at the top of the Play screen: your animal, your herd or pack, and whatever is hunting you, in the place and season you are in. Settings has a Classic view if you prefer the original.'],
    ['Markers', 'A coloured ring shows danger next door (green calm, amber wary, red dangerous). A snowflake marks ground that is deadly this winter. A star marks where your goal lies.'],
  ] },
  { id: 'meta', title: 'What carries over', items: [
    ['Account level', 'XP from every life. Levels unlock perks: odds on buttons, a birth reroll, a second mutation slot, wider sight.'],
    ['Mutations', 'Small passive abilities with a price: Zigzag, Keen Nose, Thick Coat. Pick one before a life (two from level 4). After 10 uses a mutation reaches Tier II.'],
    ['Codex', 'What you know about each animal, 0 to 100. Spotting, escaping, watching and beating a species all add to it. Dying to it adds least.'],
    ['Mastery', 'Grows with time lived as a species. It widens your sight when you play that species.'],
    ['Unlocking species', 'Wolf: fill the Wolf codex entry, or win a life as a deer. There is also a hidden species to find.'],
    ['Birth luck', 'Season, Start and Place are rolled for each life. Luck shifts the odds; it does not decide the life.'],
  ] },
  { id: 'saves', title: 'Saves', items: [
    ['Where your progress lives', 'On this device, in this browser. Nothing is sent anywhere. Clearing site data erases it.'],
    ['Save code', 'Settings can copy your progress as a save code. Paste it on another device, or keep it somewhere safe as a backup.'],
    ['Offline', 'Once loaded, the game works without a connection. Add it to your home screen to play it like an app.'],
  ] },
  { id: 'credits', title: 'Credits', items: [
    ['TierZoo', 'Species is built on the foundation laid by TierZoo, the YouTube series by Patrick "Patch" Lacey that explains evolution as if animals were players choosing builds in a game. The idea for this game comes from there. Find it at tierzoo.com.'],
    ['Independent', 'Species is a fan-made game. It is not affiliated with or endorsed by TierZoo.'],
    ['Made by', 'Akshay Rathore.'],
  ] },
];

export function Guide(p: { onClose: () => void; closeLabel: string }) {
  const [open, setOpen] = useState<string>('loop');
  return (
    <div className="screen pad stack" data-screen="guide">
      <h2>How to play</h2>
      {SECTIONS.map((s) => (
        <div key={s.id} className="guidesec">
          <button type="button" className="btn guidehead" aria-expanded={open === s.id} onClick={() => setOpen(open === s.id ? '' : s.id)}>
            <span>{s.title}</span><span className="dim">{open === s.id ? '−' : '+'}</span>
          </button>
          {open === s.id && (
            <dl className="guidelist">
              {s.items.map(([term, text]) => (
                <div key={term}><dt>{term}</dt><dd>{text}</dd></div>
              ))}
            </dl>
          )}
        </div>
      ))}
      <button className="btn primary center" onClick={p.onClose}>{p.closeLabel}</button>
    </div>
  );
}
