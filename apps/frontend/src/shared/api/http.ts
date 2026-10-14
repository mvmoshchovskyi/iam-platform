import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

/** Application client — auth header + refresh-on-401 interceptors are attached in interceptors.ts. */
export const http = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});
