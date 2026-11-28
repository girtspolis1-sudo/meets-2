import test from 'node:test';
import assert from 'node:assert/strict';
import {gameTeams,teamKey,teamSport,teamsWithGames,validTeamFollow} from '../lib/team-key.js';

// The same results as public.meets_team_key() (checked against Postgres with the migration).
test('the key matches the database function',()=>{
 assert.equal(teamKey('  RBS A.Kraukļa  VEF – U16V ','basketball'),'basketball:rbs a.kraukļa vef - u16v');
 assert.equal(teamKey('VEF Rīga','basketball'),'basketball:vef rīga');
 assert.equal(teamKey('VEF  Rīga','basketball'),'basketball:vef rīga');
 assert.equal(teamKey('HK Zemgale / LBTU','ice_hockey'),'ice_hockey:hk zemgale / lbtu');
 assert.equal(teamKey('Ogres BS U15V','Basketball'),'basketball:ogres bs u15v');
 assert.equal(teamKey('  ','basketball'),'');
 assert.equal(teamKey('VEF Rīga',''),'');
});

test('tournament sports map to the league sport',()=>{
 assert.equal(teamSport('basket5x5'),'basketball');
 assert.equal(teamSport('basket3x3'),'basketball');
 assert.equal(teamSport('hockey'),'ice_hockey');
 assert.equal(teamSport('football'),'football');
 assert.equal(teamKey('FK Mārupe',teamSport('football')),'football:fk mārupe');
});

test('both teams of a game, when known',()=>{
 assert.deepEqual(gameTeams({home_team:'VEF Rīga',away_team:'BK Ogre',sport_format:'basketball'}).map(t=>t.key),['basketball:vef rīga','basketball:bk ogre']);
 assert.deepEqual(gameTeams({home_team:'VEF Rīga',away_team:'',sport_format:'basketball'}).map(t=>t.name),['VEF Rīga']);
 assert.deepEqual(gameTeams({home_team:'VEF Rīga',away_team:'BK Ogre'}),[],'no sport, no key');
});

test('what the API accepts',()=>{
 assert.equal(validTeamFollow('VEF Rīga','basketball'),true);
 assert.equal(validTeamFollow('','basketball'),false);
 assert.equal(validTeamFollow('VEF Rīga','basket ball'),false);
 assert.equal(validTeamFollow('x'.repeat(121),'basketball'),false);
 assert.equal(validTeamFollow('A','ice_hockey'),true);
});

test('followed teams with their coming games, soonest first',()=>{
 const follows=[{team_key:'basketball:bk ogre',team_name:'BK Ogre',sport:'basketball'},{team_key:'basketball:vef rīga',team_name:'VEF Rīga',sport:'basketball'},{team_key:'ice_hockey:hk mogo',team_name:'HK Mogo',sport:'ice_hockey'}];
 const games=[{team_key:'basketball:vef rīga',event_id:'e1'},{team_key:'basketball:bk ogre',event_id:'e2'},{team_key:'basketball:bk ogre',event_id:'gone'}];
 const events=[{id:'e1',date_from:'2026-11-29'},{id:'e2',date_from:'2026-12-01'}];
 const out=teamsWithGames(follows,games,events);
 assert.deepEqual(out.map(t=>[t.team_name,t.games.map(g=>g.id)]),[['VEF Rīga',['e1']],['BK Ogre',['e2']],['HK Mogo',[]]]);
});
