import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { User } from '@prisma/client';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BetsService } from './bets.service';
import { CreateBetDto } from './dto/create-bet.dto';
import { VoteDto } from './dto/vote.dto';
import { BetResponse } from './responses/bet-response';

@ApiTags('Bets')
@ApiCookieAuth('boardman_token')
@Controller('bets')
@UseGuards(JwtAuthGuard)
export class BetsController {
  constructor(private readonly betsService: BetsService) {}

  @Post()
  @ApiOperation({ summary: "Create a new bet and lock the creator's stake" })
  @ApiResponse({ status: 201, type: BetResponse, description: 'Bet created' })
  @ApiResponse({
    status: 400,
    description: 'Invalid participants or insufficient balance',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(
    @Body() dto: CreateBetDto,
    @Request() req: ExpressRequest & { user: User },
  ) {
    return this.betsService.createBet(dto, req.user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all bets the authenticated user is involved in',
  })
  @ApiResponse({
    status: 200,
    type: [BetResponse],
    description: 'List of bets',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findMine(@Request() req: ExpressRequest & { user: User }) {
    return this.betsService.getMyBets(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single bet by ID' })
  @ApiResponse({ status: 200, type: BetResponse, description: 'Bet details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'User is not a participant in this bet',
  })
  @ApiResponse({ status: 404, description: 'Bet not found' })
  findOne(
    @Param('id') id: string,
    @Request() req: ExpressRequest & { user: User },
  ) {
    return this.betsService.getBetById(id, req.user.id);
  }

  @Post(':id/accept')
  @ApiOperation({ summary: 'Accept a bet invite and lock stake' })
  @ApiResponse({
    status: 201,
    type: BetResponse,
    description: 'Invite accepted',
  })
  @ApiResponse({
    status: 400,
    description: 'Already responded, bet not pending, or insufficient balance',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Participant record not found' })
  accept(
    @Param('id') id: string,
    @Request() req: ExpressRequest & { user: User },
  ) {
    return this.betsService.acceptBet(id, req.user.id);
  }

  @Post(':id/decline')
  @ApiOperation({
    summary: 'Decline a bet invite and refund all accepted stakes',
  })
  @ApiResponse({
    status: 201,
    type: BetResponse,
    description: 'Invite declined, stakes refunded',
  })
  @ApiResponse({ status: 400, description: 'Already responded' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Participant record not found' })
  decline(
    @Param('id') id: string,
    @Request() req: ExpressRequest & { user: User },
  ) {
    return this.betsService.declineBet(id, req.user.id);
  }

  @Post(':id/open-voting')
  @ApiOperation({ summary: 'Open the voting phase (creator only)' })
  @ApiResponse({ status: 201, type: BetResponse, description: 'Voting opened' })
  @ApiResponse({ status: 400, description: 'Bet is not active' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Only the creator can open voting' })
  @ApiResponse({ status: 404, description: 'Bet not found' })
  openVoting(
    @Param('id') id: string,
    @Request() req: ExpressRequest & { user: User },
  ) {
    return this.betsService.openVoting(id, req.user.id);
  }

  @Post(':id/vote')
  @ApiOperation({ summary: 'Submit an outcome vote' })
  @ApiResponse({ status: 201, type: BetResponse, description: 'Vote recorded' })
  @ApiResponse({
    status: 400,
    description: 'Voting not open, already voted, or invalid winner',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'User is not a participant in this bet',
  })
  submitVote(
    @Param('id') id: string,
    @Body() dto: VoteDto,
    @Request() req: ExpressRequest & { user: User },
  ) {
    return this.betsService.vote(id, req.user.id, dto);
  }
}
