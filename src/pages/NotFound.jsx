import React from "react";
import { Link } from "react-router-dom";

export default function NotFound(){
  return (
    <div style={{display:"grid", placeItems:"center", height:"100vh", textAlign:"center"}}>
      <div>
        <div style={{fontSize:48, fontWeight:800, letterSpacing:.5}}>404</div>
        <div style={{opacity:.8, marginBottom:16}}>Page not found</div>
        <Link className="btn" to="/">Back to Dashboard</Link>
      </div>
    </div>
  );
}
