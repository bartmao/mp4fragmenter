import fs = require('fs')
import MP4Parser from 'mp4parser'

class Sample {
    Size: number;
    DT: number;
    CT: number;
    Type: string;
    Chunk: number;
    Position: number;
    Description: number;
}

class TrackContext {
    Type: string;
    Timescale: number;
    ChunkOffset: Array<number> = [];
    SampleToChunk: Array<{ FirstChunk: number, SamplesPerChunk: number, SampleDescriptionIndex: number }> = [];
    SampleSize: Array<number> = [];
    Dt: Array<{ SampleCount: number, SampleDelta: number }> = [];
    Ct: Array<{ SampleCount: number, SampleOffset: number }> = [];
    SyncSample: Array<number> = [];
}

class MoovContext {
    Tracks: Array<TrackContext> = [];
    CurrentTrack: TrackContext;

    public getSamples(trackId: number): Array<Sample> {
        let samples: Array<Sample> = [];

        let track = this.Tracks[trackId];
        let i_SampleToChunk = 0;
        let c_SampleToChunk = track.SampleToChunk[i_SampleToChunk].SamplesPerChunk;
        let chunk = track.SampleToChunk[i_SampleToChunk].FirstChunk;
        let curSampleOffset = track.ChunkOffset[chunk - 1];
        let i_dt = 0;
        let c_dt = track.Dt[i_dt].SampleCount;
        let i_ct = 0;
        let c_ct = track.Ct[i_ct].SampleCount;
        let curSampleDt = 0;
        let i_SyncSample = 0;
        for (var i = 0; i < track.SampleSize.length; i++) {
            var sample = new Sample();
            sample.Size = track.SampleSize[i];
            if (c_SampleToChunk == 0) {
                c_SampleToChunk = track.SampleToChunk[++i_SampleToChunk].SamplesPerChunk;
                chunk++;
                curSampleOffset = track.ChunkOffset[chunk - 1];
            }
            c_SampleToChunk--;
            sample.Chunk = chunk;
            sample.Description = track.SampleToChunk[i_SampleToChunk].SampleDescriptionIndex;
            sample.Position = curSampleOffset;
            curSampleOffset += sample.Size;

            if (c_dt == 0) {
                c_dt = track.Dt[++i_dt].SampleCount;
            }
            c_dt--;
            if (c_ct == 0) {
                c_ct = track.Ct[++i_ct].SampleCount;
            }
            c_ct--;
            sample.DT = curSampleDt;
            curSampleDt += track.Dt[i_dt].SampleDelta;
            sample.CT = sample.DT + track.Ct[i_ct].SampleOffset;

            if (i + 1 == track.SyncSample[i_SyncSample]) {
                sample.Type = 'I';
                if (i_SyncSample < track.SyncSample.length)
                    i_SyncSample++;
            }
            samples.push(sample);
        }

        return samples;
    }

    private distinct(arr: Array<any>) {
        var flags = [], output = [], l = arr.length, i;
        for (i = 0; i < l; i++) {
            if (flags[arr[i]]) continue;
            flags[arr[i]] = true;
            output.push(arr[i]);
        }
        return output;
    }

    public split(from: number, to: number) {
        var track = this.Tracks[0];
        var samples = this.getSamples(0);
        var timescale = track.Timescale;
        var filtered = samples.filter(s => s.DT >= from * timescale && s.DT <= to * timescale);

        var keptDescriptions = this.distinct(filtered.map(s => s.Description));
        var keptChunks = this.distinct(filtered.map(s => s.Chunk));

        let i = 0;
        let new_stts = [];
        let delta = 0;
        filtered.forEach(s => {
            if (new_stts.length == 0) {
                new_stts.push({ sample_count: 1, sample_delta: filtered[1].DT });
                delta = filtered[i].DT;
            }else{
                ///let newDelta = s.DT - delta;
                //if(new_stts[i].count = )
            }
        });
    }
}

let parser = new MP4Parser(fs.createReadStream('resource/30s.mp4'));
let context = new MoovContext();
parser.on('atom', atom => {
    var seq = "00" + atom._seq;
    seq = seq.substring(seq.length - 3, seq.length);
    console.log(`${seq}. |${new Array(atom._level * 3).join('-')}${atom.type}(size:${atom.size}, pos:${atom._pos})`);
});

function init() {
    parser.on('data_hdlr', data => {
        let atom = data as Buffer;
        context.CurrentTrack.Type = atom.toString('utf8', 12 + 4, 4);
    });

    parser.on('data_mdhd', data => {
        let atom = data as Buffer;
        var track = new TrackContext();
        context.Tracks.push(track);
        context.CurrentTrack = track;
        context.CurrentTrack.Timescale = atom.readUInt32BE(12 + 8);
    });

    parser.on('data_stco', data => {
        let atom = data as Buffer;
        let offset = 12;
        let entry_count = atom.readUInt32BE(offset);
        offset += 4;
        for (var i = 0; i < entry_count; i++) {
            let chunk_offset = atom.readUInt32BE(offset);
            offset += 4;
            //console.log(`chunk_offset ${chunk_offset}`);
            context.CurrentTrack.ChunkOffset.push(chunk_offset);
        }
    });
    parser.on('data_stsc', data => {
        let atom = data as Buffer;
        let offset = 12;
        let entry_count = atom.readUInt32BE(offset);
        offset += 4;
        for (var i = 0; i < entry_count; i++) {
            let first_chunk = atom.readUInt32BE(offset);
            offset += 4;
            let samples_per_chunk = atom.readUInt32BE(offset);
            offset += 4;
            let sample_description_index = atom.readUInt32BE(offset);
            offset += 4;
            // console.log(`first_chunk ${first_chunk}`);
            // console.log(`samples_per_chunk ${samples_per_chunk}`);
            // console.log(`sample_description_index ${sample_description_index}`);
            context.CurrentTrack.SampleToChunk.push({
                FirstChunk: first_chunk,
                SamplesPerChunk: samples_per_chunk,
                SampleDescriptionIndex: sample_description_index
            });
        }
    });
    parser.on('data_stsz', data => {
        let atom = data as Buffer;
        let offset = 12;
        let sample_size = atom.readUInt32BE(offset);
        offset += 4;
        let sample_count = atom.readUInt32BE(offset);
        offset += 4;
        let counter = 1;
        if (sample_size == 0)
            for (var i = 0; i < sample_count; i++) {
                let entry_size = atom.readUInt32BE(offset);
                offset += 4;
                context.CurrentTrack.SampleSize.push(entry_size);
            }
    });
    parser.on('data_stts', data => {
        let atom = data as Buffer;
        let offset = 12;
        let entry_count = atom.readUInt32BE(offset);
        offset += 4;
        for (var i = 0; i < entry_count; i++) {
            let sample_count = atom.readUInt32BE(offset);
            offset += 4;
            let sample_delta = atom.readUInt32BE(offset);
            offset += 4;
            context.CurrentTrack.Dt.push({
                SampleCount: sample_count,
                SampleDelta: sample_delta
            });
            // console.log(`sample_count ${sample_count}`);
            // console.log(`sample_delta ${sample_delta}`);
        }
    });
    parser.on('data_ctts', data => {
        let atom = data as Buffer;
        let offset = 12;
        let entry_count = atom.readUInt32BE(offset);
        offset += 4;
        for (var i = 0; i < entry_count; i++) {
            let sample_count = atom.readUInt32BE(offset);
            offset += 4;
            let sample_offset = atom.readUInt32BE(offset);
            offset += 4;
            context.CurrentTrack.Ct.push({
                SampleCount: sample_count,
                SampleOffset: sample_offset
            });
            // console.log(`sample_count ${sample_count}`);
            // console.log(`sample_offset ${sample_offset}`);
        }
    });
    parser.on('data_stss', data => {
        let atom = data as Buffer;
        let offset = 12;
        let entry_count = atom.readUInt32BE(offset);
        offset += 4;
        for (var i = 0; i < entry_count; i++) {
            let sample_number = atom.readUInt32BE(offset);
            offset += 4;
            context.CurrentTrack.SyncSample.push(sample_number);
            //console.log(`sample_number ${sample_number}`);
        }
    });
}

init();
parser.start();

setTimeout(function () {
    context.split(0, 100);
    // var samples = context.getSamples();
    // var counter = 1;
    // samples.forEach(s => {
    //     console.log(`${counter++}:${s.Position}, ${s.Size}, ${s.DT}, ${s.CT},${s.Chunk}`)
    // });
    // //console.log(samples);
}, 2000);

function splitVideo(start: number, end: number) {

}