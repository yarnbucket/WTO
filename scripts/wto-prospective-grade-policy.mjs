// Explicit prospective grading policy, never applied to historical archives.
// Grades are derived at publication time and carry the policy ID for future audit.
export const POLICY_ID="wto-prospective-probability-bands-v1";
export function prospectiveGrade(probability){
 if(!Number.isFinite(probability)||probability<0.5||probability>1)return null;
 if(probability>=0.85)return "A++";
 if(probability>=0.75)return "A+";
 if(probability>=0.65)return "A";
 return "UNRATED";
}
export function gradeAtPublication(archive,publishedAt){
 const at=Date.parse(publishedAt);
 if(!Number.isFinite(at))throw Error("Valid publication timestamp required");
 if(!Array.isArray(archive?.games)||!archive.games.length)throw Error("Games required");
 return {...archive,confidence_policy_id:POLICY_ID,confidence_published_at:publishedAt,
 games:archive.games.map(g=>{
  const kickoff=Date.parse(g.kickoff);
  if(!Number.isFinite(kickoff)||at>=kickoff)throw Error("Cannot assign grade at/after kickoff: "+g.game_id);
  if(!g.projection_generated_at||Date.parse(g.projection_generated_at)>=kickoff||Date.parse(g.projection_generated_at)>at)throw Error("Invalid original projection timestamp: "+g.game_id);
  const grade=prospectiveGrade(g.projection?.win_probability);
  if(!grade)throw Error("Invalid original win probability: "+g.game_id);
  if(g.projection?.confidence_grade && g.projection.confidence_grade!==grade)throw Error("Conflicting original grade: "+g.game_id);
  return {...g,projection:{...g.projection,confidence_grade:grade,confidence_policy_id:POLICY_ID}};
 })};
}
