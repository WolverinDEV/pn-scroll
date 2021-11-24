package dev.wolveringer.pnscroll.util

import java.util.*

class PerformanceInfo {
    data class PerformanceReport(private val time: Long, private val info: String) {
        fun time() : Long {
            return this.time;
        }

        fun info() : String {
            return this.info;
        }
    }

    data class InfoEntry(var timestamp: Long, var name: String)

    private val baseline = System.currentTimeMillis()
    private val entries: LinkedList<InfoEntry> = LinkedList()

    fun mark(name: String) {
        this.entries.add(InfoEntry(System.currentTimeMillis(), name));
    }

    fun finish(name: String) : PerformanceReport {
        this.mark(name);

        val result = StringBuilder()
        var currentBaseline = this.baseline

        for (entry in this.entries) {
            result.append("\n")
            result.append("+ %03dms %s".format(entry.timestamp - currentBaseline, entry.name))
            currentBaseline = entry.timestamp
        }

        return PerformanceReport(this.entries.last!!.timestamp - this.baseline, result.toString().substring(1))
    }
}