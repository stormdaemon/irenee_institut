import {mkdirSync,readFileSync,writeFileSync,readdirSync,rmSync} from "node:fs";
import {createCoverageMap} from "istanbul-lib-coverage";
const url=process.env.TEST_DATABASE_URL;
if(!url||!/security_test/i.test(new URL(url).pathname))throw new Error("Explicit isolated TEST_DATABASE_URL containing security_test required.");
mkdirSync("coverage",{recursive:true});
const suites=["lib",...readdirSync("tests/api").filter(f=>f.endsWith(".test.ts")).map(f=>"tests/api/"+f)];
const merged=createCoverageMap({});let failed=false;
for(const [index,suite] of suites.entries()){
 const file=`coverage/api-part-${index}.json`;rmSync(file,{force:true});
 const child=Bun.spawn([process.execPath,"test","--preload","./scripts/api-coverage-preload.ts","--timeout","20000",suite],{
  env:{...process.env,DATABASE_URL:url,API_COVERAGE_FILE:file},stdout:"inherit",stderr:"inherit"});
 if(await child.exited)failed=true;
 try{merged.merge(JSON.parse(readFileSync(file,"utf8")))}catch{failed=true;console.error(`No coverage produced for ${suite}`)}
}
writeFileSync("coverage/api-coverage.json",JSON.stringify(merged.toJSON()));
const gate=Bun.spawn([process.execPath,"run","scripts/check-api-coverage.ts"],{stdout:"inherit",stderr:"inherit"});
const result=await gate.exited;process.exit(failed?1:result);
