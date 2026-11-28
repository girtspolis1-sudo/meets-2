// A team's key for following it: "sport:name", the same as public.meets_team_key()
// in supabase/migrations/20261128210000_follow_team.sql. Teams have no table: a team
// is its name within a sport, as the league imports and the tournaments write it.
// Pure; tests in tests/team-key.test.js.

const DASHES=/[‐‑‒–—―]/g;

export function teamKey(name,sport){
 const n=String(name??''),s=String(sport??'').trim();
 if(!n.trim()||!s)return '';
 return s.toLowerCase()+':'+n.replace(DASHES,'-').replace(/ /g,' ').toLowerCase().replace(/\s+/g,' ').trim();
}

// A tournament's sport (lib/tournament.js SPORTS) as event_sports_metadata.sport_format.
const TOURNAMENT_SPORT={basket3x3:'basketball',basket5x5:'basketball',hockey:'ice_hockey'};
export const teamSport=sport=>TOURNAMENT_SPORT[sport]||String(sport||'');

// The two teams of a league game that can be followed: [{name, sport, key}].
export function gameTeams(event){
 const sport=String(event?.sport_format||'');
 return [event?.home_team,event?.away_team].map(name=>String(name||'').trim())
  .filter(Boolean).map(name=>({name,sport,key:teamKey(name,sport)})).filter(t=>t.key);
}

// Limits of public.meets_user_team_follows.
export const TEAM_FOLLOW_LIMIT=100;
export function validTeamFollow(name,sport){
 const n=String(name??'').trim(),s=String(sport??'').trim(),key=teamKey(n,s);
 return Boolean(key)&&n.length<=120&&s.length<=40&&/^[a-z0-9_]+$/.test(s)&&key.length>=3&&key.length<=200;
}

// The followed teams with their coming games for /sekosana: follows from the account,
// games as [{team_key, event_id}] (meets_team_follow_games), events from the catalogue.
export function teamsWithGames(follows,games,events){
 const byId=new Map((events||[]).map(e=>[String(e.id),e]));
 return (follows||[]).map(f=>({...f,games:(games||[]).filter(g=>g.team_key===f.team_key)
  .map(g=>byId.get(String(g.event_id))).filter(Boolean)}))
  .sort((a,b)=>String(a.games[0]?.date_from||'9999').localeCompare(String(b.games[0]?.date_from||'9999'))||a.team_name.localeCompare(b.team_name,'lv'));
}
