export class TopUserAnalyticsDto {
  userId!: string;
  email!: string;
  name?: string | null;
  totalOutbound!: string;
}

export class TopUsersResponseDto {
  users!: TopUserAnalyticsDto[];
}
