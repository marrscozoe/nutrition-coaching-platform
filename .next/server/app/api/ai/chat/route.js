"use strict";(()=>{var e={};e.id=76,e.ids=[76],e.modules={399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},4770:e=>{e.exports=require("crypto")},4017:(e,t,r)=>{r.r(t),r.d(t,{originalPathname:()=>f,patchFetch:()=>m,requestAsyncStorage:()=>h,routeModule:()=>d,serverHooks:()=>g,staticGenerationAsyncStorage:()=>p});var n={};r.r(n),r.d(n,{POST:()=>c});var o=r(9303),a=r(8716),i=r(670),s=r(7070),l=r(5748),u=r(3466);async function c(e){try{let t=e.headers.get("x-client-id");if(!t)return s.NextResponse.json({error:"Client ID required"},{status:401});let{message:r,mealData:n,weightData:o,preferredProvider:a}=await e.json(),i=await (0,l.uU)("SELECT * FROM clients WHERE id = ?",t);if(!i)return s.NextResponse.json({error:"Client not found"},{status:404});let c={clientName:i.name,gender:i.gender||"male",currentPhase:i.current_phase||1,goalWeight:i.goal_weight||0,currentWeight:i.current_weight||i.starting_weight||0,startingWeight:i.starting_weight||i.current_weight||0,programType:i.program_type||"general_health",eventDate:i.event_date,weekNumber:(()=>{if(!i.goal_start_date)return 1;let e=new Date(i.goal_start_date+"T12:00:00"),t=new Date,r=Math.floor((t.getTime()-e.getTime())/6048e5);return Math.max(1,r+1)})(),trainerNotes:i.notes};if(n){let e=(0,u.mV)(c,{mealType:n.mealType||"meal",foodDescription:n.foodDescription||n.description||"",analyzedText:n.analyzedText,onPhase:!1!==n.onPhase,messedUp:n.messedUp}),t=await (0,u.Nc)([{role:"system",content:e}],"",a);if(t.error||!t.text){let e=(0,u.PL)(n.foodDescription||"",c);return s.NextResponse.json({response:e.advice,type:"meal_analysis",provider:t.provider||"fallback"})}return s.NextResponse.json({response:t.text,type:"meal_analysis",provider:t.provider})}if(o){let e=o.previousWeight?o.previousWeight:i.current_weight||i.starting_weight||c.startingWeight,t=o.weight,r=void 0!==o.change?o.change:e-t,n=(0,u.R2)(c,{weight:t,previousWeight:e,change:r}),l=await (0,u.Nc)([{role:"system",content:n}],"",a);if(l.error||!l.text){let r=(0,u.$g)(t,e,c.goalWeight,c.gender);return s.NextResponse.json({response:r,type:"weight_analysis",provider:l.provider||"fallback"})}return s.NextResponse.json({response:l.text,type:"weight_analysis",provider:l.provider})}if(!r||0===r.trim().length)return s.NextResponse.json({error:"Message is required"},{status:400});let d=(0,u.t6)(c,r),h=await (0,u.Nc)([{role:"system",content:d}],r,a);if(h.error||!h.text){let e=function(e,t){let r=e.replace(/['\u2019]/g,"'").toLowerCase();if(r.includes("motivat")||r.includes("i got this")||r.includes("you got this")||r.includes("lets go")||r.includes("gooooo")||r.includes("come on")||r.includes("push")||r.includes("hype")||r.includes("inspire")){let e=["You Got This! \uD83D\uDCAA Don't let your brain prevent your body from reaching your goal!","LETS GOOOO! \uD83D\uDD25 You're doing this — one meal at a time!","Oh looookout! Good things happening! \uD83D\uDCAA Keep crushing it!","If you want to look better than the average population, you have to do what the average population won't! \uD83D\uDE4C","Everyone falls off track. It's those that get back on track and those that don't. You got this! \uD83D\uDCAA"];return e[Math.floor(Math.random()*e.length)]}if(r.includes("what is")||r.includes("what are")||r.includes("what a")||r.includes("define")||r.includes("list of")||r.includes("examples of")||r.includes("what's a")||r.includes("whats a")){if(r.includes("protein")){let e="male"===t.gender?"6oz":"4oz";return`Great question! Lean protein options (fresh or frozen, NO CANS):

• ${u.M8.join("\n• ")}

Your portion: ${e} per meal

No cheese or dairy while dieting! Keep it lean! 💪`}if(r.includes("carb")||r.includes("starch")){let e="male"===t.gender?"2 cups":"1 cup";return 1===t.currentPhase?`Starchy carbohydrates (fresh or frozen, NO CANS):

• ${u.bn.join("\n• ")}

⚠️ NO STARCHES IN PHASE 1!
Your portion: ${e} per meal (when you reach Phase 2+)

Stay focused! Keep it lean! 💪`:2===t.currentPhase?`Starchy carbohydrates (fresh or frozen, NO CANS):

• ${u.bn.join("\n• ")}

✅ STARCH ALLOWED on Wed, Sat, Sun (first 2 meals only)
Your portion: ${e} per meal cooked

Keep it clean! 💪`:3===t.currentPhase?`Starchy carbohydrates (fresh or frozen, NO CANS):

• ${u.bn.join("\n• ")}

⚠️ PHASE 3 is a checkpoint - check with your coach!
Your portion: ${e} per meal cooked

Keep it lean! 💪`:`Starchy carbohydrates (fresh or frozen, NO CANS):

• ${u.bn.join("\n• ")}

✅ STARCH ALLOWED every meal in Phase 4!
Your portion: ${e} per meal cooked

Keep it clean! 💪`}if(r.includes("veggie")||r.includes("vegetable")||r.includes("fiber")||r.includes("what greens")){let e="male"===t.gender?"2 cups":"1-2 cups";return`Load up on fibrous veggies (fresh or frozen, NO CANS)! Great options:

• ${u.Hz.join("\n• ")}

Your portion: ${e} per meal

Fill half your plate! Fiber fills you up without the calories. 💪`}if(r.includes("fat")||r.includes("fats")||r.includes("healthy fat")||r.includes("what fat")){let e="male"===t.gender?"2 tablespoons":"1 tablespoon";return`Healthy fats for your meals:

• ${u.wK.join("\n• ")}

Your portion: ${e} per meal

Use sparingly! Good fats support hormone health and nutrient absorption. 💪`}}if(r.includes("what can i eat")||r.includes("what to eat")||r.includes("what should i eat")||r.includes("meal plan")||r.includes("example meal")||r.includes("my plan")||r.includes("show me what")||r.includes("give me a")||r.includes("next meal")){let e=u.E8[t.gender],r=1===t.currentPhase?"NO STARCH - lean protein, veggies, healthy fats only":2===t.currentPhase?"Add starch (Wed, Sat, Sun) to first 2 meals":3===t.currentPhase?"Check with coach for next steps":"Maintenance mode - add starch to every meal",n="male"===t.gender?"6oz chicken/fish/egg/beef/pork":"4oz chicken/fish/egg/beef/pork",o=1===t.currentPhase?"\n• NO STARCH in Phase 1!":2===t.currentPhase?"\n• Starch allowed on Wed, Sat, Sun only (first 2 meals)":"\n• Starch allowed every meal in Phase 4",a="male"===t.gender?`• ${e.protein} chicken breast
• 2 cups green beans
• 2 tablespoons olive oil`:`• ${e.protein} chicken breast
• 1-2 cups green beans
• 1 tablespoon olive oil`;return`You're in PHASE ${t.currentPhase}: ${r}

YOUR PORTIONS PER MEAL:
• Protein: ${e.protein} (${n})
• Veggies: ${e.fibrousVegetables} (broccoli, spinach, asparagus, zucchini, peppers, salad)
• Fat: ${e.fat} (olive oil, avocado, almonds, walnuts)${o}
• Water: ${"male"===t.gender?"128oz":"80oz"} daily

EXAMPLE MEAL:
${a}

Ask me anything about specific foods! 💪`}if(r.includes("eat")||r.includes("meal")||r.includes("food")||r.includes("breakfast")||r.includes("lunch")||r.includes("dinner")||r.includes("snack")||r.includes("chicken")||r.includes("beef")||r.includes("veggie")||r.includes("vegetable")||r.includes("fat")||r.includes("starch")||r.includes("what can i")||r.includes("what should i")||r.includes("what am i"))return(0,u.PL)(e,t).advice;if((r.includes("portion")||r.includes("size")||r.includes("ounce")||r.includes("cup")||r.includes("tablespoon")||r.includes("how much")||r.includes("amount"))&&!r.includes("phase")){let e="male"===t.gender?"128oz":"80oz",r="male"===t.gender?"6oz protein, 2 cups veggies, 2 tbsp fat per meal. No starch in Phase 1!":"4oz protein, 1-2 cups veggies, 1 tbsp fat per meal. No starch in Phase 1!";return`Phase ${t.currentPhase} portions: ${r} ${e} water daily. Keep crushing it! 💪`}if(r.includes("phase"))return`💡 Plan your meals out for the next few days.
💡 Cook in bulk on Sunday and Wednesday.

Keep crushing it! 💪`;if(r.includes("hello")||r.includes("hey")||r.includes("hi ")||r.includes("how are")||r.includes("whats up")||r.includes("what's up"))return`Hey ${t.clientName||"there"}! Ready to crush it today? 💪 Log those foods and let's go!`;if(r.includes("weight")||r.includes("lost")||r.includes("gained")||r.includes("progress")||r.includes("down")||r.includes("scale")){let e=t.startingWeight-t.currentWeight,r=e>0?`Down ${e.toFixed(1)} lbs from where you started! 🔥`:"",n=t.currentWeight-t.goalWeight,o=n>0?`${n.toFixed(1)} lbs to go! Keep pushing! 💪`:"You're at goal! \uD83C\uDF89";return`${r} ${o}`.trim()}let n=["Log your foods and get back on track next meal! You've got this! \uD83D\uDCAA","Keep your goal in focus! One meal at a time! \uD83D\uDD25","Don't turn a bad meal into a bad week — plan those foods! \uD83D\uDCAA","IT'S GONNA BE A GREAT DAY! Get after it! \uD83D\uDCAA"];return n[Math.floor(Math.random()*n.length)]}(r,c);return s.NextResponse.json({response:e,type:"fallback",error:h.error,provider:h.provider})}return s.NextResponse.json({response:h.text,type:"coach",provider:h.provider})}catch(e){return console.error("AI chat error:",e),s.NextResponse.json({error:"Chat failed"},{status:500})}}let d=new o.AppRouteRouteModule({definition:{kind:a.x.APP_ROUTE,page:"/api/ai/chat/route",pathname:"/api/ai/chat",filename:"route",bundlePath:"app/api/ai/chat/route"},resolvedPagePath:"/Users/openclawassistant/.openclaw/workspace/nutrition-coaching-platform/src/app/api/ai/chat/route.ts",nextConfigOutput:"",userland:n}),{requestAsyncStorage:h,staticGenerationAsyncStorage:p,serverHooks:g}=d,f="/api/ai/chat/route";function m(){return(0,i.patchFetch)({serverHooks:g,staticGenerationAsyncStorage:p})}}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),n=t.X(0,[276,972,68,225],()=>r(4017));module.exports=n})();