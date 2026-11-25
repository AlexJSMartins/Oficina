import { Test, TestingModule } from '@nestjs/testing';
import { FiscalService } from './fiscal.service';

describe('FiscalService', () => {
  let service: FiscalService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FiscalService],
    }).compile();

    service = module.get<FiscalService>(FiscalService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
