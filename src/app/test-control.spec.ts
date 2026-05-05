import { TestBed } from '@angular/core/testing';

import { TestControl } from './test-control';

describe('TestControl', () => {
  let service: TestControl;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TestControl);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
