"use client";
import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { clearSession } from '../store';
import type { RootState } from '../store';

export function Navbar({ onSelectTab, activeTab }: { onSelectTab: (tab: string) => void; activeTab: string }) {
  const dispatch = useDispatch();
  const auth = useSelector((state: RootState) => state.auth);

  return (
    <nav className="navbar">
      <a href="#" className="logo" onClick={(e) => { e.preventDefault(); onSelectTab('home'); }}>
        🏢 YayeTech Hotel
      </a>

      <div className="nav-links">
        <button 
          className={`btn ${activeTab === 'home' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => onSelectTab('home')}
        >
          Home
        </button>

        {auth.user ? (
          <>
            <button 
              className={`btn ${activeTab === 'profile' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => onSelectTab('profile')}
            >
              Profile ({auth.user.fullName})
            </button>
            <button className="btn btn-outline" onClick={() => dispatch(clearSession())}>
              Sign Out
            </button>
          </>
        ) : (
          <>
            <button 
              className={`btn ${activeTab === 'login' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => onSelectTab('login')}
            >
              Sign In
            </button>
            <button 
              className={`btn ${activeTab === 'register' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => onSelectTab('register')}
            >
              Register
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
