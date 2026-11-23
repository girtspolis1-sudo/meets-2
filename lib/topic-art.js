import {eventTopicIcon} from './event-map-icons.js';
import {cardCategory,cardGroup} from './discovery-card.js';

// The theme picture for an event without its own image (prompt_tema_bildes.md).
// The theme comes from the same reading as the map icons (eventTopicIcon: the
// sport, then the category, then the title); the scenes are in
// app/components/topic-scenes.jsx. Palettes are dark brand tones.
export const TOPIC_PALETTES={priede:'#1d3a32',karmins:'#3b1a21',bruns:'#2b2416',tinte:'#1b2430',slate:'#262e3a'};

const BY_TOPIC={
 'Basketbols':['basketbols','priede'],
 'Volejbols':['volejbols','priede'],
 'Futbols':['futbols','priede'],
 'Hokejs':['hokejs','tinte'],
 'Peldēšana':['peldesana','tinte'],
 'Skriešana':['skriesana','priede'],
 'Vieglatlētika':['skriesana','priede'],
 'Tirdziņš':['tirdzins','bruns'],
 'Ziemassvētki':['ziemassvetki','priede'],
 'Svētki':['svetki','bruns'],
 'Valsts svētki':['valsts-svetki','tinte'],
 'Koncerts':['koncerts','karmins'],
 'Teātris':['teatris','karmins'],
 'Kino':['kino','tinte'],
 'Dejas':['dejas','karmins'],
 'Izstāde':['izstade','tinte'],
 'Bibliotēka':['biblioteka','tinte'],
 'Radošā darbnīca':['darbnica','slate'],
 'Pašvaldība':['pasvaldiba','slate'],
 'Pašvaldības un līdzdalība':['pasvaldiba','slate'],
 'Izglītība':['izglitiba','slate'],
 'Datorapmācības':['izglitiba','slate'],
 'Senioriem':['senioriem','slate'],
 'Veselība':['veseliba','slate'],
 'Donoru diena':['veseliba','slate'],
 'Atceres pasākums':['atceres','tinte'],
 'Reliģisks pasākums':['atceres','tinte'],
 'Tikšanās':['tiksanas','slate'],
 'Bērniem':['berniem','slate'],
 'Ģimenēm':['berniem','slate'],
 'Viktorīna':['viktorina','slate']
};
// No recognised theme: the group's picture, else the calendar.
const BY_GROUP={
 music:['koncerts','karmins'],stage:['teatris','karmins'],culture:['izstade','tinte'],
 markets:['tirdzins','bruns'],learning:['izglitiba','slate'],community:['tiksanas','slate'],
 civic:['pasvaldiba','slate'],family:['berniem','slate'],active:['kalendars','priede'],sport:['kalendars','priede']
};

// Stable 0/1 from the event id, so neighbouring events of one theme can differ.
export function artVariant(id){
 const s=String(id??'');let h=0;
 for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;
 return h%2?'B':'A';
}

// {scene, palette, color, variant, label}: label is the theme for the chip when
// one is recognised ("BASKETBOLS"), otherwise the group's name.
export function topicArt(event){
 const topic=eventTopicIcon(event||{}).label;
 const hit=BY_TOPIC[topic];
 const [scene,palette]=hit||BY_GROUP[cardGroup(event||{})]||['kalendars','tinte'];
 return {scene,palette,color:TOPIC_PALETTES[palette],variant:artVariant(event?.id),label:hit?topic:cardCategory(event||{})};
}
