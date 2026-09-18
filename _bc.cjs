const esbuild=require('esbuild');
const names=['initAuth','signIn','isSignedIn','getEmail','getName','onAuth','gReadTab','gLoadConfig','gSaveConfig','gSaveRows','gSaveHistorico','gHistorico','gLoadAdmins','gSaveAdmins','gLoadMarcas','gSaveMarcas','gPlan2027','gLoadEstado','gSaveEstado','gLoadClientes','gAddCliente','gSyncBaseClientes'];
const stub='export const '+names.map(n=>n+'=()=>{}').join(',')+';';
esbuild.build({entryPoints:['src/App.jsx'],bundle:true,write:false,format:'esm',
 plugins:[{name:'stub',setup(b){b.onResolve({filter:/\.\/google$/},a=>({path:'g',namespace:'s'}));b.onResolve({filter:/\.css$/},a=>({path:'c',namespace:'s'}));b.onLoad({filter:/.*/,namespace:'s'},a=>({contents:a.path==='g'?stub:'export default {}',loader:'js'}))}}],
 loader:{'.js':'jsx'},absWorkingDir:process.cwd()}).then(()=>console.log('BUILD OK')).catch(e=>{console.error(e.message);process.exit(1)});
