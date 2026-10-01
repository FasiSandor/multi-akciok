import { NextResponse } from 'next/server';
export async function GET(){ return NextResponse.json({offers:[],refreshedAt:new Date().toISOString(),mode:'probe'}); }
