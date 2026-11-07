import test from 'node:test';
import assert from 'node:assert/strict';
import {videoCapacity,scenarioTable} from '../scripts/calculate-video-capacity.mjs';

test('capacity accounts for setup at each session and only counts complete videos',()=>{
 const r=videoCapacity({quotaSeconds:3600,setupSeconds:600,videoSeconds:300,sessionSeconds:1800});
 assert.equal(r.attempts,8);assert.equal(r.sessions,2);assert.equal(r.consumedSeconds,3600);
 assert.equal(videoCapacity({quotaSeconds:3600,setupSeconds:600,videoSeconds:300,sessionSeconds:600}).attempts,0);
});
test('capacity separates planned reserve and observed success from ideal throughput',()=>{
 const r=videoCapacity({quotaSeconds:108000,videoSeconds:600,reserveFraction:0.2,successFraction:0.75});
 assert.equal(r.attempts,144);assert.equal(r.successfulVideos,108);
 assert.deepEqual(scenarioTable().map(r=>r.attempts),[288,144,96,72,48,24]);
});
test('capacity rejects zero timings and invalid fractions instead of inventing production',()=>{
 for(const args of [{videoSeconds:0},{videoSeconds:NaN},{videoSeconds:60,reserveFraction:1},{videoSeconds:60,successFraction:2}])assert.throws(()=>videoCapacity(args),/invalid_capacity_inputs/);
 assert.equal(videoCapacity({quotaSeconds:0,videoSeconds:60}).attempts,0);
});
