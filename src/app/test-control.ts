import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TestControlService {

  private baseUrl = 'http://localhost:8080/api/test';

  constructor(private http: HttpClient) {}

  startTest(testKey: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/start`, { testKey });
  }

  stopTest(): Observable<any> {
    return this.http.post(`${this.baseUrl}/stop`, {});
  }

  getStatus(): Observable<any> {
    return this.http.get(`${this.baseUrl}/status`);
  }

  getTests(): Observable<any> {
    return this.http.get(`${this.baseUrl}/list`);
  }
}