import { h } from './util.js';
import { withIcon } from './icons.js';
import { state, save } from './state.js';
import { sfx } from './audio.js';
import { setKeyHandler, getKeyHandler } from './ui.js';

export const REPAIRED = 10; // Rettungspunkte bis „repariert“
export const SHINING = 25; // Rettungspunkte bis „strahlend“
export const STORY_PLANETS = ['pyramid', 'sequence', 'asteroid', 'scale', 'binary', 'magic', 'fraction', 'builder'];
export const STAGE_NAMES = ['beschädigt', 'repariert', 'strahlend'];

export const CHARS = {
  pi: { e: '🦉', n: 'Professor Pi' },
  wirrwarr: { e: '🦹', n: 'Graf Wirrwarr' },
  nulla: { e: '🌑', n: 'Königin Nulla' },
};

/* ------------------------------------------------------------------ */
/* Galaxie 1: Numeria – Graf Wirrwarr                                  */
/* ------------------------------------------------------------------ */
const NUMERIA = {
  name: 'Numeria',
  villain: 'wirrwarr',
  fortress: { e: '🏰', n: 'Wirrwarrs Festung', where: 'mitten im Chaos-Nebel' },
  bossHp: 15,
  taunts: [
    'Hahaha! Du hast meine schöne Unordnung aufgeräumt? Das war meine Lieblings-Unordnung!',
    'Pah! Ein Planet repariert – na und? Ich habe noch ganz viel Durcheinander auf Lager!',
    'Wer bist du überhaupt? Hör sofort auf, alles zu sortieren!',
    'Grrr! Du rechnest ja schneller, als ich verwirbeln kann!',
  ],
  planets: {
    pyramid: {
      npc: { e: '👸', n: 'Pharaonin Summa' },
      radio: [
        ['npc', 'Hilfe! Hier spricht Pharaonin Summa von Pyramidia. Graf Wirrwarr hat die Steine unserer Tempel durcheinandergeworfen!'],
        ['pi', 'Bei Pyramidia ist jeder Stein die Summe der zwei Steine darunter. Wer das Gesetz kennt, kann alles wieder aufbauen.'],
      ],
      repaired: 'Die Tempel stehen wieder! Die Leute tanzen auf den Treppen.',
      shining: 'Unsere Pyramiden leuchten heller als je zuvor! Du bekommst den Ehrentitel „Baumeister-Genie von Pyramidia“.',
      msg: 'ORDNUNG NERVT',
      reaction: ['pi', '„Ordnung nervt“? Pff. Ordnung ist die Superkraft der Mathematik!'],
    },
    sequence: {
      npc: { e: '🧑‍✈️', n: 'Kapitän Folgerich' },
      radio: [
        ['npc', 'Kapitän Folgerich vom Code-Kometen hier! Unser Sternentor öffnet sich nur mit dem richtigen Zahlencode – und Wirrwarr hat alle Codes verwürfelt.'],
        ['pi', 'Jeder Code folgt einer Regel. Finde die Regel, dann findest du die Zahl.'],
      ],
      repaired: 'Das Sternentor summt wieder! Wir können zurück auf unsere Umlaufbahn.',
      shining: 'Der Komet zieht jetzt einen Schweif aus funkelnden Zahlen hinter sich her – dank dir!',
      msg: 'MUSTER SIND OEDE',
      reaction: ['pi', 'Muster öde? Muster sind das Geheimnis hinter Blumen, Musik und Sternen!'],
    },
    asteroid: {
      npc: { e: '👷', n: 'Minenchefin Prima' },
      radio: [
        ['npc', 'Achtung, Achtung! Minenchefin Prima aus dem Asteroiden-Gürtel. Wirrwarr hat riesige Felsbrocken auf unsere Station geschubst!'],
        ['pi', 'Wir zerlegen sie in Primzahl-Kristalle. Primzahlen kann niemand weiter zerbrechen – nicht mal Wirrwarr.'],
      ],
      repaired: 'Die Station ist sicher! Und wir haben jetzt jede Menge Kristalle.',
      shining: 'Aus den Primzahl-Kristallen bauen wir einen Leuchtturm für das ganze All!',
      msg: 'ICH MAG KRACH',
      reaction: ['pi', 'Krach mag er also. Ich mag lieber das leise Klick, wenn eine Rechnung aufgeht.'],
    },
    scale: {
      npc: { e: '🐘', n: 'Waagemeister Otto' },
      radio: [
        ['npc', 'Hallo? Hier ist Otto vom Waagen-Mond. Wirrwarr hat die Schilder von allen Kisten abgerissen! Niemand weiß mehr, was wie schwer ist.'],
        ['pi', 'Eine Waage im Gleichgewicht verrät alles – wenn man auf beiden Seiten gleich viel wegnimmt.'],
      ],
      repaired: 'Alle Kisten haben wieder ihr Gewicht! Der Markt hat geöffnet.',
      shining: 'Du bist das größte Waagen-Genie, das der Mond je gesehen hat!',
      msg: 'SCHIEF IST TOLL',
      reaction: ['pi', 'Schief findet er toll … aber auf einer schiefen Waage kann man nichts herausfinden!'],
    },
    binary: {
      npc: { e: '🤖', n: 'Robo-Königin Bitta' },
      radio: [
        ['npc', '01001000 01101001! Oh, Verzeihung. Hier spricht Königin Bitta. Wirrwarr hat unseren Robotern die Zahlen vertauscht – sie verstehen nur noch Lichter.'],
        ['pi', 'Jede Lampe ist doppelt so viel wert wie die rechts daneben: 1, 2, 4, 8, 16 … So denken auch Computer!'],
      ],
      repaired: 'Die Roboter rechnen wieder! Einer hat vor Freude Pirouetten gedreht.',
      shining: 'Wir haben dir zu Ehren ein Lied in Binärcode komponiert. Es heißt 101010.',
      msg: 'ROBOTER WIRR',
      reaction: ['pi', 'Die Roboter sind nicht wirr – sie sprechen nur eine andere Sprache. Und die kannst du jetzt!'],
    },
    magic: {
      npc: { e: '🧙', n: 'Zauberer Quadratus' },
      radio: [
        ['npc', 'Bei meinem Bart! Wirrwarr hat Zahlen aus meinen Zauberquadraten gestohlen. Ohne sie wirkt kein einziger Zauber.'],
        ['pi', 'In einem magischen Quadrat ergibt jede Reihe dieselbe Summe. Findest du sie, findest du die fehlenden Zahlen.'],
      ],
      repaired: 'Simsalabim – es funktioniert wieder! Meine Kaninchen kommen wieder aus dem Hut.',
      shining: 'Ich ernenne dich zum Ehrenmitglied der Zauberzunft. Dein Zauberwort: Zaubersumme!',
      msg: 'ZAUBER WEG',
      reaction: ['pi', 'Der Zauber ist nicht weg. Er steckt in den Zahlen – und die hast du zurückgeholt.'],
    },
    fraction: {
      npc: { e: '👩‍🍳', n: 'Köchin Krume' },
      radio: [
        ['npc', 'Hier Bruchstation, Köchin Krume am Apparat! Wirrwarr hat alle Energiekerne falsch aufgeteilt. Das reinste Chaos!'],
        ['pi', 'Ein Bruch sagt: In wie viele gleiche Teile teilen wir – und wie viele nehmen wir? Dann wird es gerecht.'],
      ],
      repaired: 'Endlich gerecht verteilt! Jeder bekommt sein Stück Energie – und Pizza.',
      shining: 'Zur Feier gibt es eine Riesenpizza in 12 Stücken. 3/12 davon sind für dich – das ist genau ein Viertel!',
      msg: 'PIZZA KAPUTT',
      reaction: ['pi', 'Eine Pizza in Stücken ist nicht kaputt – sie ist bereit zum Teilen!'],
    },
    builder: {
      npc: { e: '🦫', n: 'Bauleiter Kante' },
      radio: [
        ['npc', 'Biber Kante von Geometra! Wirrwarr hat unsere Landeplätze zertrampelt. Kein Raumschiff kann mehr landen!'],
        ['pi', 'Fläche ist, wie viele Kästchen du belegst. Umfang ist der Zaun drumherum. Zusammen bauen wir neue Landeplätze!'],
      ],
      repaired: 'Das erste Raumschiff ist gelandet! Wir haben ein rotes Band durchgeschnitten.',
      shining: 'Geometra hat jetzt den schönsten Raumhafen der Galaxie. Er trägt deinen Namen!',
      msg: 'FANG MICH DOCH',
      reaction: ['pi', '„Fang mich doch“? Machen wir! Jedes Signal verrät uns ein Stück seines Verstecks.'],
    },
    duel: {
      radio: [
        ['pi', 'Vorsicht! Das ist der Chaos-Kern, Wirrwarrs Wachroboter. Er greift mit Rechenblitzen an.'],
        ['pi', 'Wer gegen ihn trainiert, wird blitzschnell im Kopfrechnen. Das brauchen wir für den letzten Kampf!'],
      ],
    },
  },
  scenes: {
    prolog: [
      ['pi', 'Willkommen an der Sternenakademie, {name}! Ich bin Professor Pi, dein Mentor. Ja, ich bin eine Eule. Und eine Zahl. Lange Geschichte.'],
      ['pi', 'Wir haben ein Problem. Ein großes. Eins mit vielen Nullen.'],
      ['villain', 'Hahaha! Ich bin Graf Wirrwarr! Ordnung ist sooo langweilig. Darum habe ich ganz Numeria durcheinandergewirbelt!'],
      ['villain', 'Pyramiden eingestürzt, Codes verdreht, Zahlen gestohlen! Und niemand kann mich finden. Niemand!'],
      ['pi', 'Jeder Planet hat ein Rätsel, das Wirrwarr verwürfelt hat. Wenn du es löst, kehrt die Ordnung zurück – erst wird der Planet repariert, dann strahlt er.'],
      ['pi', 'Und ist ein Planet repariert, schickt Wirrwarr bestimmt eine wütende Botschaft. Darin verrät er sicher aus Versehen etwas über sein Versteck …'],
      ['me', 'Dann los! Wo fangen wir an?'],
      ['pi', 'Pyramidia, der Code-Komet und der Asteroiden-Gürtel funken schon um Hilfe. Such dir einen aus!'],
    ],
    finaleIntro: [
      ['pi', 'Alle 8 Koordinaten-Stücke! Zusammen zeigen sie auf einen Ort mitten im Chaos-Nebel.'],
      ['pi', 'Dort steht Wirrwarrs Festung. Er wird alles auf uns werfen, was er hat: Rätsel von allen Planeten – und am Ende kämpft er selbst.'],
      ['villain', 'Ihr habt mich gefunden?! Unmöglich! Das war gegen jede Unordnung!'],
      ['me', 'Gib auf, Wirrwarr! Wir bringen die Ordnung zurück.'],
      ['villain', 'Niemals! Zeig mir erst, ob du schneller rechnest als ich!'],
    ],
    ending: [
      ['villain', 'Nein … nein! Meine schöne Unordnung … alles wieder sortiert …'],
      ['me', 'Warum hast du das überhaupt gemacht?'],
      ['villain', '*schnief* Alle in Numeria waren immer so beschäftigt. Keiner hat mit mir gespielt. Da dachte ich: Wenn alles kaputt ist, sehen sie mich wenigstens.'],
      ['me', 'Rätsel kann man auch zusammen lösen. Das macht sogar viel mehr Spaß. Willst du mitmachen?'],
      ['villain', 'Wirklich? Ich … ich wäre gern dabei. Ich bin übrigens ziemlich gut im Würfeln.'],
      ['pi', 'Numeria ist gerettet! Und wir haben einen neuen Freund. Ich bin stolz auf dich, {name}.'],
      ['pi', 'Oh! Ein neues Signal … aus einer Galaxie, die noch nie jemand besucht hat: Infinitas. Dort verschwinden Zahlen einfach im Nichts!'],
      ['ally', 'Das ist Königin Nulla. Ich kenne sie. Gegen sie war ich ein Kuscheltier. Die Rätsel dort sind viel kniffliger – ich komme mit!'],
    ],
  },
};

/* ------------------------------------------------------------------ */
/* Galaxie 2: Infinitas – Königin Nulla                               */
/* ------------------------------------------------------------------ */
const INFINITAS = {
  name: 'Infinitas',
  villain: 'nulla',
  fortress: { e: '🕳️', n: 'Nullas Palast', where: 'im Punkt Null, genau in der Mitte von Infinitas' },
  bossHp: 20,
  taunts: [
    'Wer füllt mein schönes Nichts wieder mit Zahlen? Hör auf damit!',
    'Ein Planet mehr voller Zahlen … wie anstrengend. Ich lösche einfach zwei neue.',
    'Null ist friedlich. Null ist still. Warum willst du unbedingt zählen?',
    'Du bist hartnäckig. Aber das Nichts ist geduldiger als du!',
  ],
  planets: {
    pyramid: {
      name: 'Turmalin', emoji: '🗼',
      intro: 'Höhere Zahlentürme als auf Pyramidia – und es fehlen mehr Steine!',
      npc: { e: '🦒', n: 'Turmwächterin Hochstapel' },
      radio: [
        ['npc', 'Hier Hochstapel, Turmwächterin von Turmalin! Unsere Türme haben Löcher – die Steine sind einfach … weg! Ins Nichts!'],
        ['ally', 'Typisch Nulla. Aber Steine, die man ausrechnen kann, kann man auch zurückholen!'],
      ],
      repaired: 'Die Türme stehen wieder! Ich kann wieder über die Wolken gucken.',
      shining: 'Von hier oben sehe ich bis ans Ende von Infinitas … nein, Moment: Infinitas hat ja gar kein Ende!',
      msg: 'ALLES WIRD NULL',
      reaction: ['pi', 'Alles wird null? Null plus null ist null – aber du bist viel mehr wert!'],
    },
    sequence: {
      name: 'Spiralia', emoji: '🌀',
      intro: 'Die Zahlenmuster hier sind wilder als auf dem Code-Kometen.',
      npc: { e: '🐚', n: 'Muschelmeisterin Spira' },
      radio: [
        ['npc', 'Hallo, hier ist Spira! Unsere Spiralen wachsen nach Zahlenmustern – 1, 1, 2, 3, 5, 8 … Aber Nulla hat Löcher hineingefressen!'],
        ['pi', 'Wer das Muster versteht, kann jede Lücke füllen. Und zwar immer weiter, bis in die Unendlichkeit!'],
      ],
      repaired: 'Die Spiralen drehen sich wieder! Mir ist ein bisschen schwindelig vor Freude.',
      shining: 'Unsere Spirale ist jetzt so groß, dass man sie von jeder Galaxie aus sieht.',
      msg: 'KEIN ENDE',
      reaction: ['ally', 'Kein Ende … Ich glaube, genau davor hat Nulla Angst.'],
    },
    asteroid: {
      name: 'Primwüste', emoji: '🏜️',
      intro: 'Riesige Zahlenfelsen: Zerlege sie in Primzahlen.',
      npc: { e: '🦂', n: 'Skorpion Teilo' },
      radio: [
        ['npc', 'Psst! Skorpion Teilo hier. Nulla hat unsere Oase unter Felsen begraben. Zerlegt sie – aber nur mit dem richtigen Laser!'],
        ['ally', 'Primzahl-Kristalle! Die mag ich. Die kann nicht mal ich durcheinanderbringen.'],
      ],
      repaired: 'Wasser! Die Oase sprudelt wieder!',
      shining: 'In der Wüste blühen jetzt Kristallblumen – mit 2, 3, 5 und 7 Blütenblättern.',
      msg: 'NICHTS BLEIBT',
      reaction: ['pi', 'Nichts bleibt? Primzahlen bleiben. Für immer. Das hat Euklid schon vor 2000 Jahren bewiesen.'],
    },
    scale: {
      name: 'Libra-Station', emoji: '🛰️',
      intro: 'Doppelwaagen mit oft zwei Unbekannten auf einmal.',
      npc: { e: '🦩', n: 'Flamingo Libby' },
      radio: [
        ['npc', 'Flamingo Libby hier! Ich stehe auf einem Bein, weil alles so wackelt! Nulla hat unsere Waagen verhext.'],
        ['pi', 'Zwei Waagen, zwei Geheimnisse. Wenn du sie vergleichst, verraten sie sich gegenseitig.'],
      ],
      repaired: 'Alles im Gleichgewicht! Ich könnte wieder auf beiden Beinen stehen … aber ich bleibe lieber auf einem.',
      shining: 'Die Station schwebt so ruhig wie nie. Du bist ein Gleichungs-Genie!',
      msg: 'LEER IST SCHOEN',
      reaction: ['ally', 'Leer ist schön? Eine leere Waagschale ist doch langweilig! Das sage sogar ich.'],
    },
    binary: {
      name: 'Oktavia', emoji: '🐙',
      intro: 'Mit 8 Lampen kann man bis 255 zählen!',
      npc: { e: '🐙', n: 'Krake Oktavia' },
      radio: [
        ['npc', 'Blubb! Krake Oktavia hier. Nulla hat alle meine 8 Lampen ausgeknipst. Ohne Licht finde ich nicht mal meine eigenen Arme!'],
        ['pi', '8 Lampen sind ein Byte. Damit speichern Computer einen einzigen Buchstaben!'],
      ],
      repaired: 'Es werde Licht! Alle 8 Arme leuchten.',
      shining: 'Ich habe dir eine Lichtshow programmiert: 11111111 – alles an! Das ist 255!',
      msg: 'NUR NULLEN',
      reaction: ['pi', 'Nur Nullen? 00000000 ist wirklich null. Aber schon eine einzige 1 macht einen Unterschied.'],
    },
    magic: {
      name: 'Runenhain', emoji: '🌳',
      intro: 'Die Zaubersumme ist verschwunden – oft musst du sie selbst finden.',
      npc: { e: '🧝', n: 'Runenelfe Magna' },
      radio: [
        ['npc', 'Seid gegrüßt. Ich bin Magna. Unsere Zauberquadrate sind verblasst, und ihre Zaubersummen sind verschwunden.'],
        ['pi', 'Trick: Eine volle Reihe verrät die Zaubersumme. Und die Mitte ist bei 3×3-Quadraten immer genau ein Drittel davon!'],
      ],
      repaired: 'Die Runen glühen wieder! Der Wald flüstert Zahlen.',
      shining: 'Jedes Blatt im Hain trägt jetzt ein Zauberquadrat. Eines davon trägt deinen Namen.',
      msg: 'STILLE UEBERALL',
      reaction: ['ally', 'Stille überall … klingt einsam. Ich weiß, wie sich das anfühlt.'],
    },
    fraction: {
      name: 'Krümelstern', emoji: '🧁',
      intro: 'Brüche vergleichen, addieren und Anteile berechnen.',
      npc: { e: '🐭', n: 'Mäusekoch Krümel' },
      radio: [
        ['npc', 'Piep! Mäusekoch Krümel hier. Nulla hat aus allen Torten Stücke verschwinden lassen. Wie viel ist noch übrig?'],
        ['pi', 'Brüche helfen uns, Teile von Ganzen zu verstehen. Und manchmal sind 2/4 genauso viel wie 1/2!'],
      ],
      repaired: 'Die Torten sind wieder ganz! Und es duftet nach Zimt.',
      shining: 'Ich backe dir eine Torte in 8 Stücken. 8/8 davon sind für dich – also die ganze!',
      msg: 'NULL TEILE',
      reaction: ['pi', 'Null Teile? Durch null teilen geht nicht. Aber mit Freunden teilen geht immer.'],
    },
    builder: {
      name: 'Polygonia', emoji: '💎',
      intro: 'Knifflige Formen: gleiche Fläche, ganz anderer Umfang!',
      npc: { e: '🦔', n: 'Baumeisterin Stachel' },
      radio: [
        ['npc', 'Baumeisterin Stachel hier! Nulla hat unsere Kristallstadt ausradiert. Wir brauchen neue Plätze – genau nach Plan!'],
        ['pi', 'Zwei Formen können gleich groß sein und trotzdem verschieden lange Zäune haben. Probier es aus!'],
      ],
      repaired: 'Die ersten Kristallhäuser stehen! Das Licht bricht sich in tausend Farben.',
      shining: 'Polygonia funkelt! Wir haben einen Platz nach dir benannt – Fläche 25, Umfang 20!',
      msg: 'ICH LOESCHE ALLES',
      reaction: ['ally', 'Sie löscht alles, weil ihr alles zu viel ist. Wir müssen sie finden – und mit ihr reden.'],
    },
    duel: {
      name: 'Nichts-Wächter', emoji: '👻',
      intro: 'Jede richtige Antwort trifft den Nichts-Wächter, schnelle doppelt!',
      boss: { e: '👻', n: 'Nichts-Wächter', hp: 12 },
      radio: [
        ['ally', 'Das ist Nullas Nichts-Wächter. Er frisst Zahlen, wenn man zu langsam ist!'],
        ['pi', 'Trainiere hier dein Blitzrechnen – für den Kampf gegen Nulla.'],
      ],
    },
  },
  scenes: {
    prolog: [
      ['pi', 'Willkommen in Infinitas, der unendlichen Galaxie!'],
      ['ally', 'Hier war ich noch nie. Es ist so … still.'],
      ['villain', 'Wer stört meine Ruhe? Ich bin Königin Nulla. In meinem Reich wird jede Zahl zu Null. Null ist friedlich. Null hört auf.'],
      ['villain', 'Diese Galaxie hat kein Ende – das ist unerträglich! Also mache ich sie leer. Stück für Stück.'],
      ['pi', 'Die Rätsel hier sind schwerer, {name}. Aber du bist auch viel stärker geworden.'],
      ['me', 'Und diesmal haben wir sogar Wirrwarr dabei!'],
      ['ally', 'Genau! Mit Unfug kenne ich mich aus. Nulla schickt bestimmt auch Botschaften. Lasst sie uns knacken!'],
    ],
    finaleIntro: [
      ['pi', 'Alle Koordinaten! Nullas Palast liegt im Punkt Null – genau in der Mitte von Infinitas.'],
      ['ally', 'Ein Palast aus Nichts. Gruselig. Aber wir sind zu dritt!'],
      ['villain', 'Ihr wagt es, hierherzukommen? Hier endet alles. Hier wird alles zu Null!'],
      ['me', 'Dann zeige ich dir, dass Zahlen stärker sind als das Nichts!'],
    ],
    ending: [
      ['villain', 'Meine Leere … sie füllt sich wieder mit Zahlen …'],
      ['me', 'Warum willst du eigentlich, dass alles verschwindet?'],
      ['villain', 'Weil es niemals aufhört! Nach jeder Zahl kommt noch eine. Und noch eine. Unendlich viele. Das macht mir Angst.'],
      ['pi', 'Ach, Nulla. Weißt du nicht, wie wichtig du bist? Ohne die Null gäbe es keine 10, keine 100, keine 1000. Du hältst die Stellen frei!'],
      ['me', 'Und die Unendlichkeit ist nicht gruselig. Sie bedeutet nur: Es gibt immer noch ein Rätsel mehr zu entdecken.'],
      ['villain', 'Ich … halte die Stellen frei? Ich bin … wichtig?'],
      ['ally', 'Willkommen im Club der Ex-Bösewichte! Wir haben Kekse. Unendlich viele.'],
      ['pi', '{name}, du hast zwei Galaxien gerettet. Die Sternenakademie verleiht dir den höchsten Titel, den es gibt: GENIUS!'],
    ],
  },
};

export const GALAXIES = [NUMERIA, INFINITAS];

/* ------------------------------------------------------------------ */
/* Fortschritt                                                         */
/* ------------------------------------------------------------------ */

const key = (id, gal = state.galaxy) => `${gal}:${id}`;
export const points = (id, gal = state.galaxy) => state.restore[key(id, gal)] || 0;
export const stageOf = (id, gal = state.galaxy) => (points(id, gal) >= SHINING ? 2 : points(id, gal) >= REPAIRED ? 1 : 0);
export const isDecoded = (id, gal = state.galaxy) => !!state.decoded[key(id, gal)];
export const messageWaiting = (id, gal = state.galaxy) => STORY_PLANETS.includes(id) && stageOf(id, gal) >= 1 && !isDecoded(id, gal);
export const coordsFound = (gal = state.galaxy) => STORY_PLANETS.filter((id) => isDecoded(id, gal)).length;
export const finaleUnlocked = (gal = state.galaxy) => coordsFound(gal) === STORY_PLANETS.length;

export function addPoints(id, n) {
  if (!STORY_PLANETS.includes(id)) return;
  state.restore[key(id)] = points(id) + n;
}

export function markDecoded(id) {
  state.decoded[key(id)] = true;
  save();
}

/** Planet view for the current galaxy: game module merged with story overrides. */
export function planetInfo(game, gal = state.galaxy) {
  const p = GALAXIES[gal].planets[game.id] || {};
  return { ...game, ...p, npc: p.npc, boss: p.boss };
}

/* ------------------------------------------------------------------ */
/* Szenen                                                              */
/* ------------------------------------------------------------------ */

export const sceneId = (kind, id = '', gal = state.galaxy) => `${gal}:${kind}:${id}`;
export const seen = (kind, id = '', gal = state.galaxy) => state.seen.includes(sceneId(kind, id, gal));

function speaker(who, ctx) {
  if (who === 'me') return { e: state.avatar, n: state.name || 'Du', side: 'right' };
  if (who === 'npc') return { ...ctx.npc, side: 'left' };
  if (who === 'villain') return { ...CHARS[GALAXIES[ctx.gal].villain], side: 'right', villain: true };
  if (who === 'ally') return { ...CHARS.wirrwarr, side: 'left' };
  return { ...CHARS[who], side: 'left' };
}

/** Build a scene: { title, lines: [[who, text]], ctx } */
export function buildScene(kind, id, gal = state.galaxy, games = {}) {
  const G = GALAXIES[gal];
  const ctx = { gal };
  if (kind === 'prolog') return { title: `Prolog: ${G.name}`, lines: G.scenes.prolog, ctx };
  if (kind === 'finaleIntro') return { title: `${G.fortress.e} ${G.fortress.n}`, lines: G.scenes.finaleIntro, ctx };
  if (kind === 'ending') return { title: `${G.name} ist gerettet!`, lines: G.scenes.ending, ctx };
  const p = planetInfo(games[id] || { id }, gal);
  ctx.npc = p.npc;
  const name = p.name;
  if (kind === 'radio') return { title: `Funkspruch: ${name}`, lines: p.radio, ctx };
  if (kind === 'repaired') {
    const taunt = G.taunts[STORY_PLANETS.indexOf(id) % G.taunts.length];
    return {
      title: `${name} ist repariert`,
      lines: [
        ['npc', p.repaired],
        ['pi', 'Moment … da kommt ein seltsames Signal herein!'],
        ['villain', taunt],
        ['pi', 'Eine verschlüsselte Botschaft! Jeder Buchstabe versteckt sich hinter einer Rechenaufgabe. Öffne den Planeten und knacke sie!'],
      ],
      ctx,
    };
  }
  if (kind === 'decoded') {
    const n = coordsFound(gal);
    return {
      title: `Botschaft von ${name}`,
      lines: [
        ['villain', `„${p.msg}“`],
        p.reaction,
        ['pi', n >= STORY_PLANETS.length
          ? `Und das letzte Koordinaten-Stück! ${n} von ${STORY_PLANETS.length}. Jetzt wissen wir, wo das Versteck ist: ${G.fortress.where}!`
          : `In dem Signal steckt ein Koordinaten-Stück! Wir haben jetzt ${n} von ${STORY_PLANETS.length}.`],
      ],
      ctx,
    };
  }
  if (kind === 'shining') {
    return { title: `Kapitel geschafft: ${name}`, lines: [['npc', p.shining], ['pi', `${name} strahlt heller als je zuvor. Dieses Kapitel ist abgeschlossen!`]], ctx };
  }
  throw new Error('Unknown scene ' + kind);
}

/** Log-book order of all scenes of a galaxy. */
export function sceneOrder(gal) {
  const list = [['prolog', '']];
  for (const id of [...STORY_PLANETS, 'duel']) {
    list.push(['radio', id]);
    if (id !== 'duel') list.push(['repaired', id], ['decoded', id], ['shining', id]);
  }
  list.push(['finaleIntro', ''], ['ending', '']);
  return list.filter(([k, id]) => state.seen.includes(sceneId(k, id, gal)));
}

let games = {};
export function registerGames(map) { games = map; }

/** Play scenes one after another: items = [{kind, id?, gal?}] */
export function playScenes(items, onDone) {
  const queue = [...items];
  const next = () => {
    const it = queue.shift();
    if (!it) { onDone?.(); return; }
    const gal = it.gal ?? state.galaxy;
    const sid = sceneId(it.kind, it.id || '', gal);
    if (!state.seen.includes(sid)) { state.seen.push(sid); save(); }
    cutscene(buildScene(it.kind, it.id, gal, games), next);
  };
  next();
}

function cutscene(sc, done) {
  let i = 0;
  let typing = null;
  let full = '';
  const avatar = h('div', { class: 'cs-avatar' });
  const name = h('div', { class: 'cs-name' });
  const text = h('p', { class: 'cs-text' });
  const bubble = h('div', { class: 'cs-bubble' }, name, text);
  const row = h('div', { class: 'cs-row' }, avatar, bubble);
  const dots = h('div', { class: 'cs-dots' }, sc.lines.map(() => h('i')));
  const finish = () => {
    clearInterval(typing);
    ov.remove();
    setKeyHandler(prevKeys); // give the keyboard back to the screen underneath
    done();
  };
  const show = () => {
    const [who, raw] = sc.lines[i];
    const sp = speaker(who, sc.ctx);
    full = raw.replaceAll('{name}', state.name || 'Kadett');
    avatar.textContent = sp.e;
    name.textContent = sp.n;
    row.className = `cs-row ${sp.side}${sp.villain ? ' villain' : ''}`;
    row.classList.remove('in');
    void row.offsetWidth;
    row.classList.add('in');
    [...dots.children].forEach((d, j) => d.classList.toggle('on', j <= i));
    text.textContent = '';
    let n = 0;
    clearInterval(typing);
    typing = setInterval(() => {
      n += 2;
      text.textContent = full.slice(0, n);
      if (n >= full.length) { clearInterval(typing); typing = null; }
    }, 22);
    sp.villain ? sfx.wrong() : sfx.tick();
  };
  const advance = () => {
    if (typing) { clearInterval(typing); typing = null; text.textContent = full; return; }
    i++;
    if (i >= sc.lines.length) finish(); else show();
  };
  const ov = h('div', { class: 'cutscene', onClick: advance },
    h('div', { class: 'cs-title' }, sc.title),
    row,
    h('div', { class: 'cs-foot' },
      dots,
      h('button', { type: 'button', class: 'btn ghost small', onClick: (e) => { e.stopPropagation(); finish(); } }, 'Überspringen'),
      h('button', { type: 'button', class: 'btn primary', onClick: (e) => { e.stopPropagation(); advance(); } }, ...withIcon('play', 'Weiter'))));
  document.body.append(ov);
  const prevKeys = getKeyHandler();
  setKeyHandler((k) => { if (k === 'ok') advance(); });
  show();
}

/* ------------------------------------------------------------------ */
/* Professor Pi – Sprechblase                                          */
/* ------------------------------------------------------------------ */

let piTimer;
export function piSay(text, ms = 6500) {
  document.getElementById('pi-say')?.remove();
  clearTimeout(piTimer);
  const el = h('div', { id: 'pi-say', role: 'status', onClick: () => el.remove() },
    h('span', { class: 'pi-face' }, CHARS.pi.e), h('div', { class: 'pi-bubble' }, h('b', {}, 'Professor Pi'), h('span', {}, text)));
  document.body.append(el);
  piTimer = setTimeout(() => el.remove(), ms);
}
