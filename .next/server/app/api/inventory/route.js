(()=>{var a={};a.id=858,a.ids=[858],a.modules={261:a=>{"use strict";a.exports=require("next/dist/shared/lib/router/utils/app-paths")},846:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},3033:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},3295:a=>{"use strict";a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},3775:(a,b,c)=>{"use strict";c.d(b,{db:()=>k,Nv:()=>p,DK:()=>m,B3:()=>o,HW:()=>n,Mc:()=>l});let d=require("node:sqlite"),e=require("node:path");var f=c.n(e);let g=require("node:fs");var h=c.n(g);let i=f().join(process.cwd(),"data");h().existsSync(i)||h().mkdirSync(i,{recursive:!0});let j=f().join(i,"pigeon.sqlite"),k=global.dbSyncInstance||new d.DatabaseSync(j);k.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS Users (
      user_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT CHECK(role IN ('Admin', 'Supervisor', 'User')) NOT NULL,
      penalty_status TEXT CHECK(penalty_status IN ('None', 'Warning', 'Restricted_Temp', 'Restricted_1_Week')) DEFAULT 'None',
      restriction_end_date TEXT
    );

    CREATE TABLE IF NOT EXISTS Inventory (
      item_id TEXT PRIMARY KEY,
      item_name TEXT NOT NULL,
      brand TEXT NOT NULL,
      qty INTEGER NOT NULL DEFAULT 0,
      min_qty_alert INTEGER NOT NULL DEFAULT 2,
      location TEXT CHECK(location IN ('ICT Lab 1', 'ICT Lab 2')) NOT NULL,
      location_detail TEXT NOT NULL,
      item_detail TEXT NOT NULL,
      variant TEXT NOT NULL,
      status TEXT CHECK(status IN ('Available', 'Borrowed', 'Damaged', 'Maintenance')) NOT NULL DEFAULT 'Available',
      condition TEXT CHECK(condition IN ('Good', 'Damaged')) NOT NULL DEFAULT 'Good',
      date_added TEXT NOT NULL,
      borrowing_type TEXT CHECK(borrowing_type IN ('Habis Pakai', 'Used', 'Loan')) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS Borrowing_Transactions (
      ticket_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES Users(user_id),
      transaction_type TEXT CHECK(transaction_type IN ('Direct_Borrow', 'Reservation')) NOT NULL,
      purpose TEXT NOT NULL,
      borrow_date TEXT NOT NULL,
      duration TEXT NOT NULL,
      expected_return_date TEXT,
      status TEXT CHECK(status IN (
        'Pending_Approval', 'Approved', 'Rejected', 'In_Queue',
        'Ready_for_Pickup', 'Picked_Up', 'Returned', 'Overdue', 'Issue_Reported'
      )) NOT NULL DEFAULT 'Pending_Approval',
      approved_by TEXT REFERENCES Users(user_id),
      rejection_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS Transaction_Items (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL REFERENCES Borrowing_Transactions(ticket_id) ON DELETE CASCADE,
      item_id TEXT NOT NULL REFERENCES Inventory(item_id),
      qty_borrowed INTEGER NOT NULL DEFAULT 1,
      borrowing_type TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS Returns_And_Penalties (
      return_id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL REFERENCES Borrowing_Transactions(ticket_id),
      return_date TEXT NOT NULL,
      returned_condition TEXT CHECK(returned_condition IN ('Good', 'Damaged_Light', 'Damaged_Medium', 'Damaged_Heavy', 'Lost')) NOT NULL,
      is_late INTEGER NOT NULL DEFAULT 0,
      late_days INTEGER NOT NULL DEFAULT 0,
      penalty_type TEXT NOT NULL,
      resolution_status TEXT CHECK(resolution_status IN ('Resolved', 'Not_Resolved')) NOT NULL DEFAULT 'Resolved',
      received_by TEXT NOT NULL REFERENCES Users(user_id)
    );

    CREATE TABLE IF NOT EXISTS Transaction_History (
      log_id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL REFERENCES Inventory(item_id),
      action_type TEXT CHECK(action_type IN ('Stock_In', 'Stock_Out', 'Returned', 'Transferred', 'Edited', 'Damaged')) NOT NULL,
      qty_changed INTEGER NOT NULL,
      timestamp TEXT NOT NULL,
      performed_by TEXT NOT NULL REFERENCES Users(user_id)
    );
  `);let l={getByEmail:a=>k.prepare("SELECT * FROM Users WHERE LOWER(email) = LOWER(?)").get(a),getById:a=>k.prepare("SELECT * FROM Users WHERE user_id = ?").get(a),getAll:()=>k.prepare("SELECT * FROM Users ORDER BY name ASC").all(),create(a){k.prepare(`
      INSERT INTO Users (user_id, name, email, role, penalty_status, restriction_end_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(a.user_id,a.name,a.email,a.role,a.penalty_status,a.restriction_end_date)},update(a){k.prepare(`
      UPDATE Users
      SET name = ?, email = ?, role = ?, penalty_status = ?, restriction_end_date = ?
      WHERE user_id = ?
    `).run(a.name,a.email,a.role,a.penalty_status,a.restriction_end_date,a.user_id)},delete(a){k.prepare("DELETE FROM Users WHERE user_id = ?").run(a)}},m={getAll(a){let b="SELECT * FROM Inventory WHERE 1=1",c=[];if(a?.location&&(b+=" AND location = ?",c.push(a.location)),a?.status&&(b+=" AND status = ?",c.push(a.status)),a?.search){b+=" AND (LOWER(item_name) LIKE ? OR LOWER(brand) LIKE ? OR LOWER(item_detail) LIKE ?)";let d=`%${a.search.toLowerCase()}%`;c.push(d,d,d)}return b+=" ORDER BY location ASC, item_name ASC",k.prepare(b).all(...c)},getById:a=>k.prepare("SELECT * FROM Inventory WHERE item_id = ?").get(a),create(a){k.prepare(`
      INSERT INTO Inventory (
        item_id, item_name, brand, qty, min_qty_alert, location, location_detail,
        item_detail, variant, status, condition, date_added, borrowing_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(a.item_id,a.item_name,a.brand,a.qty,a.min_qty_alert,a.location,a.location_detail,a.item_detail,a.variant,a.status,a.condition,a.date_added,a.borrowing_type)},update(a){k.prepare(`
      UPDATE Inventory
      SET item_name = ?, brand = ?, qty = ?, min_qty_alert = ?, location = ?,
          location_detail = ?, item_detail = ?, variant = ?, status = ?,
          condition = ?, date_added = ?, borrowing_type = ?
      WHERE item_id = ?
    `).run(a.item_name,a.brand,a.qty,a.min_qty_alert,a.location,a.location_detail,a.item_detail,a.variant,a.status,a.condition,a.date_added,a.borrowing_type,a.item_id)},delete(a){k.prepare("DELETE FROM Inventory WHERE item_id = ?").run(a)},transfer(a,b,c,d,e){let f=this.getById(a);if(!f||f.qty<d)throw Error("Stok barang asal tidak mencukupi");k.prepare("UPDATE Inventory SET qty = qty - ? WHERE item_id = ?").run(d,a);let g=k.prepare(`
      SELECT * FROM Inventory
      WHERE item_name = ? AND brand = ? AND variant = ? AND location = ?
    `).get(f.item_name,f.brand,f.variant,b),h=g?.item_id;g?k.prepare("UPDATE Inventory SET qty = qty + ? WHERE item_id = ?").run(d,g.item_id):(h=`ITM-${Date.now()}-${Math.floor(1e3*Math.random())}`,this.create({...f,item_id:h,location:b,location_detail:c||f.location_detail,qty:d,date_added:new Date().toISOString().split("T")[0]})),p.log({log_id:`LOG-${Date.now()}-1`,item_id:a,action_type:"Transferred",qty_changed:-d,timestamp:new Date().toISOString(),performed_by:e}),h&&p.log({log_id:`LOG-${Date.now()}-2`,item_id:h,action_type:"Transferred",qty_changed:d,timestamp:new Date().toISOString(),performed_by:e})}},n={getNextTicketId(){let a=k.prepare("SELECT ticket_id FROM Borrowing_Transactions ORDER BY ticket_id DESC LIMIT 1").get();if(!a)return"PGE-0001";let b=a.ticket_id.match(/PGE-(\d+)/);if(!b)return"PGE-0001";let c=parseInt(b[1],10)+1;return`PGE-${String(c).padStart(4,"0")}`},getAll(a){let b=`
      SELECT t.*, u.name as user_name, u.email as user_email
      FROM Borrowing_Transactions t
      LEFT JOIN Users u ON t.user_id = u.user_id
      WHERE 1=1
    `,c=[];a?.status&&(b+=" AND t.status = ?",c.push(a.status)),a?.user_id&&(b+=" AND t.user_id = ?",c.push(a.user_id)),b+=" ORDER BY t.borrow_date DESC";let d=k.prepare(b).all(...c);for(let a of d)a.items=k.prepare(`
        SELECT ti.*, i.item_name, i.brand, i.location
        FROM Transaction_Items ti
        LEFT JOIN Inventory i ON ti.item_id = i.item_id
        WHERE ti.ticket_id = ?
      `).all(a.ticket_id);return d},getByTicketId(a){let b=k.prepare(`
      SELECT t.*, u.name as user_name, u.email as user_email
      FROM Borrowing_Transactions t
      LEFT JOIN Users u ON t.user_id = u.user_id
      WHERE t.ticket_id = ?
    `).get(a);return b&&(b.items=k.prepare(`
        SELECT ti.*, i.item_name, i.brand, i.location
        FROM Transaction_Items ti
        LEFT JOIN Inventory i ON ti.item_id = i.item_id
        WHERE ti.ticket_id = ?
      `).all(a)),b},create(a,b){let c=a.ticket_id||this.getNextTicketId();k.prepare(`
      INSERT INTO Borrowing_Transactions (
        ticket_id, user_id, transaction_type, purpose, borrow_date,
        duration, expected_return_date, status, approved_by, rejection_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(c,a.user_id,a.transaction_type,a.purpose,a.borrow_date,a.duration,a.expected_return_date,a.status,a.approved_by,a.rejection_reason);let d=k.prepare(`
      INSERT INTO Transaction_Items (id, ticket_id, item_id, qty_borrowed, borrowing_type)
      VALUES (?, ?, ?, ?, ?)
    `);for(let a of b){let b=`TI-${Date.now()}-${Math.floor(1e3*Math.random())}`;d.run(b,c,a.item_id,a.qty_borrowed,a.borrowing_type)}return c},updateStatus(a,b,c,d){k.prepare(`
      UPDATE Borrowing_Transactions
      SET status = ?, approved_by = COALESCE(?, approved_by), rejection_reason = COALESCE(?, rejection_reason)
      WHERE ticket_id = ?
    `).run(b,c||null,d||null,a)}},o={create(a){k.prepare(`
      INSERT INTO Returns_And_Penalties (
        return_id, ticket_id, return_date, returned_condition,
        is_late, late_days, penalty_type, resolution_status, received_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(a.return_id,a.ticket_id,a.return_date,a.returned_condition,a.is_late,a.late_days,a.penalty_type,a.resolution_status,a.received_by)},getByTicketId:a=>k.prepare("SELECT * FROM Returns_And_Penalties WHERE ticket_id = ?").get(a),getAll:()=>k.prepare("SELECT * FROM Returns_And_Penalties ORDER BY return_date DESC").all()},p={log(a){k.prepare(`
      INSERT INTO Transaction_History (log_id, item_id, action_type, qty_changed, timestamp, performed_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(a.log_id,a.item_id,a.action_type,a.qty_changed,a.timestamp,a.performed_by)},getAll:(a=100)=>k.prepare(`
      SELECT th.*, i.item_name, u.name as performer_name
      FROM Transaction_History th
      LEFT JOIN Inventory i ON th.item_id = i.item_id
      LEFT JOIN Users u ON th.performed_by = u.user_id
      ORDER BY th.timestamp DESC
      LIMIT ?
    `).all(a)}},3873:a=>{"use strict";a.exports=require("path")},4870:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},5511:a=>{"use strict";a.exports=require("crypto")},6439:a=>{"use strict";a.exports=require("next/dist/shared/lib/no-fallback-error.external")},6487:()=>{},8189:(a,b,c)=>{"use strict";c.r(b),c.d(b,{handler:()=>G,patchFetch:()=>F,routeModule:()=>B,serverHooks:()=>E,workAsyncStorage:()=>C,workUnitAsyncStorage:()=>D});var d={};c.r(d),c.d(d,{DELETE:()=>A,GET:()=>x,POST:()=>y,PUT:()=>z});var e=c(5736),f=c(9117),g=c(4044),h=c(9326),i=c(2324),j=c(261),k=c(4290),l=c(5328),m=c(8928),n=c(6595),o=c(3421),p=c(7679),q=c(1681),r=c(3446),s=c(6439),t=c(4679),u=c(1356),v=c(641),w=c(3775);async function x(a){try{let{searchParams:b}=new URL(a.url),c=b.get("location")||void 0,d=b.get("status")||void 0,e=b.get("search")||void 0,f=w.DK.getAll({location:c,status:d,search:e});return v.NextResponse.json({success:!0,items:f})}catch(a){return v.NextResponse.json({success:!1,message:a.message},{status:500})}}async function y(a){try{let{item_name:b,brand:c,qty:d,min_qty_alert:e,location:f,location_detail:g,item_detail:h,variant:i,status:j,condition:k,date_added:l,borrowing_type:m,performed_by:n}=await a.json();if(!b||!c||void 0===f||!m)return v.NextResponse.json({success:!1,message:"Field wajib belum lengkap"},{status:400});let o={item_id:`ITM-${Date.now()}`,item_name:b,brand:c,qty:Number(d)||0,min_qty_alert:Number(e)||2,location:f,location_detail:g||"",item_detail:h||"",variant:i||"",status:j||"Available",condition:k||"Good",date_added:l||new Date().toISOString().split("T")[0],borrowing_type:m};return w.DK.create(o),n&&w.Nv.log({log_id:`LOG-${Date.now()}`,item_id:o.item_id,action_type:"Stock_In",qty_changed:o.qty,timestamp:new Date().toISOString(),performed_by:n}),v.NextResponse.json({success:!0,message:"Item Added Successfully",item:o})}catch(a){return v.NextResponse.json({success:!1,message:a.message},{status:500})}}async function z(a){try{let{item_id:b,item_name:c,brand:d,qty:e,min_qty_alert:f,location:g,location_detail:h,item_detail:i,variant:j,status:k,condition:l,date_added:m,borrowing_type:n,performed_by:o}=await a.json(),p=w.DK.getById(b);if(!p)return v.NextResponse.json({success:!1,message:"Barang tidak ditemukan"},{status:404});let q={item_id:b,item_name:c,brand:d,qty:Number(e),min_qty_alert:Number(f),location:g,location_detail:h,item_detail:i,variant:j,status:k,condition:l,date_added:m,borrowing_type:n};if(w.DK.update(q),o){let a=Number(e)-p.qty;w.Nv.log({log_id:`LOG-${Date.now()}`,item_id:b,action_type:"Damaged"===l&&"Damaged"!==p.condition?"Damaged":"Edited",qty_changed:a,timestamp:new Date().toISOString(),performed_by:o})}return v.NextResponse.json({success:!0,message:"Item Updated Successfully",item:q})}catch(a){return v.NextResponse.json({success:!1,message:a.message},{status:500})}}async function A(a){try{let{searchParams:b}=new URL(a.url),c=b.get("id");if(!c)return v.NextResponse.json({success:!1,message:"Item ID diperlukan"},{status:400});return w.DK.delete(c),v.NextResponse.json({success:!0,message:"Item Deleted Successfully"})}catch(a){return v.NextResponse.json({success:!1,message:a.message},{status:500})}}let B=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/inventory/route",pathname:"/api/inventory",filename:"route",bundlePath:"app/api/inventory/route"},distDir:".next",relativeProjectDir:"",resolvedPagePath:"C:\\Users\\yulli\\OneDrive\\Documents\\ict inven\\src\\app\\api\\inventory\\route.ts",nextConfigOutput:"",userland:d}),{workAsyncStorage:C,workUnitAsyncStorage:D,serverHooks:E}=B;function F(){return(0,g.patchFetch)({workAsyncStorage:C,workUnitAsyncStorage:D})}async function G(a,b,c){var d;let e="/api/inventory/route";"/index"===e&&(e="/");let g=await B.prepare(a,b,{srcPage:e,multiZoneDraftMode:!1});if(!g)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:v,params:w,nextConfig:x,isDraftMode:y,prerenderManifest:z,routerServerContext:A,isOnDemandRevalidate:C,revalidateOnlyGenerated:D,resolvedPathname:E}=g,F=(0,j.normalizeAppPath)(e),G=!!z.routes[E]&&(B.isDev||(0,t.isRouteCacheOwner)(E,B.cacheOwner,z.routes[E])),H=!!(z.dynamicRoutes[F]||G);if(H&&!y){let a=z.dynamicRoutes[F];if(a&&!1===a.fallback&&!G)throw new s.NoFallbackError}let I=null;!H||B.isDev||y||(I="/index"===(I=E)?"/":I);let J=!0===B.isDev||!H,K=H&&!J,L=a.method||"GET",M=(0,i.getTracer)(),N=M.getActiveScopeSpan(),O={params:w,prerenderManifest:z,renderOpts:{experimental:{cacheComponents:!!x.experimental.cacheComponents,authInterrupts:!!x.experimental.authInterrupts},supportsDynamicResponse:J,incrementalCache:(0,h.getRequestMeta)(a,"incrementalCache"),cacheLifeProfiles:null==(d=x.experimental)?void 0:d.cacheLife,isRevalidate:K,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d)=>B.onRequestError(a,b,d,A)},sharedContext:{buildId:v}},P=new k.NodeNextRequest(a),Q=new k.NodeNextResponse(b),R=l.NextRequestAdapter.fromNodeNextRequest(P,(0,l.signalFromNodeResponse)(b));try{let d=async c=>B.handle(R,O).finally(()=>{if(!c)return;c.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let d=M.getRootSpanAttributes();if(!d)return;if(d.get("next.span_type")!==m.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${d.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let e=d.get("next.route");if(e){let a=`${L} ${e}`;c.setAttributes({"next.route":e,"http.route":e,"next.span_name":a}),c.updateName(a)}else c.updateName(`${L} ${a.url}`)}),g=async g=>{var i,j;let k=async({previousCacheEntry:f})=>{try{if(!(0,h.getRequestMeta)(a,"minimalMode")&&C&&D&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let e=await d(g);a.fetchMetrics=O.renderOpts.fetchMetrics;let i=O.renderOpts.pendingWaitUntil;i&&c.waitUntil&&(c.waitUntil(i),i=void 0);let j=O.renderOpts.collectedTags;if(!H)return await (0,o.I)(P,Q,e,O.renderOpts.pendingWaitUntil),null;{let a=await e.blob(),b=(0,p.toNodeOutgoingHttpHeaders)(e.headers);j&&(b[r.NEXT_CACHE_TAGS_HEADER]=j),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==O.renderOpts.collectedRevalidate&&!(O.renderOpts.collectedRevalidate>=r.INFINITE_CACHE)&&O.renderOpts.collectedRevalidate,d=void 0===O.renderOpts.collectedExpire||O.renderOpts.collectedExpire>=r.INFINITE_CACHE?void 0:O.renderOpts.collectedExpire;return{value:{kind:u.CachedRouteKind.APP_ROUTE,status:e.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:d}}}}catch(b){throw(null==f?void 0:f.isStale)&&await B.onRequestError(a,b,{routerKind:"App Router",routePath:e,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:K,isOnDemandRevalidate:C})},A),b}},l=await B.handleResponse({req:a,nextConfig:x,cacheKey:I,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:z,isRoutePPREnabled:!1,isOnDemandRevalidate:C,revalidateOnlyGenerated:D,responseGenerator:k,waitUntil:c.waitUntil});if(!H)return null;if((null==l||null==(i=l.value)?void 0:i.kind)!==u.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==l||null==(j=l.value)?void 0:j.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});(0,h.getRequestMeta)(a,"minimalMode")||b.setHeader("x-nextjs-cache",C?"REVALIDATED":l.isMiss?"MISS":l.isStale?"STALE":"HIT"),y&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let m=(0,p.fromNodeOutgoingHttpHeaders)(l.value.headers);return(0,h.getRequestMeta)(a,"minimalMode")&&H||m.delete(r.NEXT_CACHE_TAGS_HEADER),!l.cacheControl||b.getHeader("Cache-Control")||m.get("Cache-Control")||m.set("Cache-Control",(0,q.getCacheControlHeader)(l.cacheControl)),await (0,o.I)(P,Q,new Response(l.value.body,{headers:m,status:l.value.status||200})),null};N?await g(N):await M.withPropagatedContext(a.headers,()=>M.trace(m.BaseServerSpan.handleRequest,{spanName:`${L} ${a.url}`,kind:i.SpanKind.SERVER,attributes:{"http.method":L,"http.target":a.url}},g))}catch(b){if(b instanceof s.NoFallbackError||await B.onRequestError(a,b,{routerKind:"App Router",routePath:F,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:K,isOnDemandRevalidate:C})}),H)throw b;return await (0,o.I)(P,Q,new Response(null,{status:500})),null}}},8335:()=>{},9121:a=>{"use strict";a.exports=require("next/dist/server/app-render/action-async-storage.external.js")},9294:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-async-storage.external.js")}};var b=require("../../../webpack-runtime.js");b.C(a);var c=b.X(0,[897,930],()=>b(b.s=8189));module.exports=c})();