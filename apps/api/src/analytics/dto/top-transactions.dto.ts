export class AnalyticsCounterpartyDto {
  id!: string;
  email!: string;
  name?: string | null;
}

export class AnalyticsTransactionDto {
  id!: string;
  type!: string;
  currency!: string;
  amount!: string;
  direction!: 'IN' | 'OUT';
  counterparty?: AnalyticsCounterpartyDto | null;
  createdAt!: Date;
}

export class UserTopTransactionsDto {
  userId!: string;
  transactions!: AnalyticsTransactionDto[];
}
