import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Capacitor} from '@capacitor/core';
import {App} from '@capacitor/app';
import SambuApp,{type User} from '../app/sambu-app';
import {apiFetch,configureApiOrigin} from '../app/lib/client-api';
import '../app/globals.css';
import '../app/review.css';
import '../app/mobile.css';
const origin=import.meta.env.VITE_SAMBU_API_ORIGIN;
// This gate stays off until public authentication and native API access are validated.
const configured=!!origin&&import.meta.env.VITE_SAMBU_NATIVE_AUTH_READY==='true';
function NativeRoot(){
  const [user,setUser]=useState<User>(null),[state,setState]=useState<'loading'|'ready'|'error'>('loading');
  const load=async()=>{
    setState('loading');
    try{if(!configured)throw new Error('Native auth pending');configureApiOrigin(origin);const response=await apiFetch('/api/session',{cache:'no-store'});if(!response.ok)throw new Error('Session unavailable');const data=await response.json() as {user:User};setUser(data.user);setState('ready');}
    catch{setState('error');}
  };
  useEffect(()=>{void load();},[]);
  useEffect(()=>{
    if(!Capacitor.isNativePlatform())return;
    const handles=[App.addListener('appStateChange',({isActive})=>window.dispatchEvent(new Event(isActive?'focus':'pagehide'))),App.addListener('backButton',({canGoBack})=>{if(canGoBack)window.history.back();else void App.minimizeApp();})];
    return()=>{for(const handle of handles)void handle.then(h=>h.remove());};
  },[]);
  if(!configured)return <main className="native-connection"><img src="/sambu-logo.png" alt="Sambu"/><h1>Sambu em preparação</h1><p>Esta versão para celular ainda não foi liberada para testes.</p></main>;
  if(state!=='ready')return <main className="native-connection"><img src="/sambu-logo.png" alt="Sambu"/><h1>{state==='loading'?'Abrindo sua biblioteca…':'Não foi possível abrir o Sambu'}</h1><p>{state==='error'?'Verifique sua conexão e tente novamente.':'Preparando suas leituras.'}</p>{state==='error'&&<button className="primary" onClick={load}>Tentar novamente</button>}</main>;
  return <SambuApp user={user}/>;
}
createRoot(document.getElementById('root')!).render(<NativeRoot/>);
