const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8');
const context=vm.createContext({});
vm.runInContext(source.slice(source.indexOf('function placement('),source.indexOf('function render()')),context);
const {layoutCards}=context;
const epsilon=1e-6;
for(let count=2;count<=16;count++)for(const square of [false,true])for(const layout of ['podium','grid']){
  test(`${count} players, ${square?'square':'landscape'}, ${layout}`,()=>{
    // Include a taller footer to exercise reduced artwork space.
    for(const height of square?[1000,1200]:[520,680]){
      const bounds={x:64,y:216,w:square?1472:1792,h:height};
      const slots=layoutCards(count,layout,square,bounds.x,bounds.y,bounds.w,bounds.h,square?21:22);
      assert.equal(slots.length,count);
      for(const r of slots){
        assert.ok(Object.values(r).every(Number.isFinite));assert.ok(r.w>0&&r.h>0);
        assert.ok(r.x>=bounds.x-epsilon&&r.y>=bounds.y-epsilon);
        assert.ok(r.x+r.w<=bounds.x+bounds.w+epsilon&&r.y+r.h<=bounds.y+bounds.h+epsilon);
      }
      for(let i=0;i<count;i++)for(let j=i+1;j<count;j++){
        const a=slots[i],b=slots[j];
        assert.ok(Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)<=epsilon||Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)<=epsilon,'Cards must not overlap');
      }
      const area=slots.map(r=>r.w*r.h);
      if(layout==='podium'){
        assert.ok(area[0]>area[1],'First place must be strictly largest');
        for(let i=1;i<count;i++)assert.ok(area[i]<=area[i-1]+epsilon,'Lower placements must not be larger');
      }else for(const a of area)assert.ok(Math.abs(a-area[0])<epsilon,'Grid cells must be equal');
    }
  });
}
test('Top 8 square keeps second place wide and both thirds equal',()=>{
  const slots=layoutCards(8,'podium',true,64,216,1472,1200,21);
  assert.ok(slots[1].w>slots[2].w);assert.equal(slots[2].w,slots[3].w);
  assert.equal(slots[2].h,slots[3].h);assert.ok(slots[1].y<slots[2].y);
});
